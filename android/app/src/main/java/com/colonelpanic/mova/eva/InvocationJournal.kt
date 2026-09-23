package com.colonelpanic.mova.eva

import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable record of EVA write invocations, keyed by caller UID and invocation
 * ID. A write is recorded as started before any network I/O and gets its
 * reply once known, so a repeated invocation never executes twice: it gets
 * the recorded reply, or `unknown` when the process died mid-write.
 */
class InvocationJournal(
    private val store: Store,
    private val wallClock: () -> Long,
    private val maxEntries: Int = 200,
    private val maxAgeMillis: Long = 14L * 24 * 60 * 60 * 1000,
) {
    interface Store {
        fun read(): String?
        fun write(text: String)
    }

    sealed class Prior {
        /** Never seen; the caller may [begin] it. */
        object None : Prior()
        data class Replay(val response: String) : Prior()
        /** Started earlier and still running in this process. */
        object InFlight : Prior()
        /** Started earlier with no recorded outcome; the process died mid-write. */
        object Interrupted : Prior()
        /** The same invocation ID arrived with a different capability or arguments. */
        object Conflict : Prior()
    }

    sealed class Recorded {
        data class Started(val running: Boolean) : Recorded()
        data class Finished(val response: String) : Recorded()
    }

    private data class Entry(val key: String, val fingerprint: String, val startedAt: Long, val response: String?)

    private var entries: MutableMap<String, Entry>? = null
    private val running = mutableSetOf<String>()

    @Synchronized
    fun lookup(callerUid: Int, invocationId: String, fingerprint: String): Prior {
        val key = key(callerUid, invocationId)
        val existing = load()[key] ?: return Prior.None
        return when {
            existing.fingerprint != fingerprint -> Prior.Conflict
            existing.response != null -> Prior.Replay(existing.response)
            key in running -> Prior.InFlight
            else -> Prior.Interrupted
        }
    }

    @Synchronized
    fun recorded(callerUid: Int, invocationId: String): Recorded? {
        val key = key(callerUid, invocationId)
        val entry = load()[key] ?: return null
        return entry.response?.let { Recorded.Finished(it) } ?: Recorded.Started(key in running)
    }

    /**
     * Durably records the write as started. False if another request claimed
     * the ID first. Throws if the record cannot be written, in which case the
     * write must not run.
     */
    @Synchronized
    fun begin(callerUid: Int, invocationId: String, fingerprint: String): Boolean {
        val all = load()
        val key = key(callerUid, invocationId)
        if (key in all) return false
        all[key] = Entry(key, fingerprint, wallClock(), null)
        prune(all)
        try {
            save(all)
        } catch (e: Exception) {
            all.remove(key)
            throw e
        }
        running.add(key)
        return true
    }

    @Synchronized
    fun finish(callerUid: Int, invocationId: String, response: String) {
        val all = load()
        val key = key(callerUid, invocationId)
        running.remove(key)
        val entry = all[key] ?: return
        all[key] = entry.copy(response = response)
        save(all)
    }

    private fun key(callerUid: Int, invocationId: String) = "$callerUid:$invocationId"

    private fun load(): MutableMap<String, Entry> {
        entries?.let { return it }
        val parsed = linkedMapOf<String, Entry>()
        try {
            val array = store.read()?.let { JSONArray(it) } ?: JSONArray()
            for (i in 0 until array.length()) {
                val o = array.getJSONObject(i)
                val entry = Entry(
                    o.getString("key"),
                    o.getString("fingerprint"),
                    o.getLong("startedAt"),
                    if (o.isNull("response")) null else o.getString("response"),
                )
                parsed[entry.key] = entry
            }
        } catch (e: Exception) {
            // An unreadable journal must not block new work; losing it only
            // loses replay of old replies, and EVA never repeats uncertain work.
        }
        return parsed.also { entries = it }
    }

    private fun prune(all: MutableMap<String, Entry>) {
        val cutoff = wallClock() - maxAgeMillis
        all.values.removeAll { it.startedAt < cutoff && it.key !in running }
        val excess = all.size - maxEntries
        if (excess > 0) {
            all.values.filter { it.key !in running }.sortedBy { it.startedAt }.take(excess)
                .forEach { all.remove(it.key) }
        }
    }

    private fun save(all: Map<String, Entry>) {
        val array = JSONArray()
        all.values.forEach { e ->
            array.put(
                JSONObject()
                    .put("key", e.key)
                    .put("fingerprint", e.fingerprint)
                    .put("startedAt", e.startedAt)
                    .put("response", e.response ?: JSONObject.NULL)
            )
        }
        store.write(array.toString())
    }
}
