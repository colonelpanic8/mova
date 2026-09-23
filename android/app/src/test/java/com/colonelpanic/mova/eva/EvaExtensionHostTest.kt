package com.colonelpanic.mova.eva

import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class EvaExtensionHostTest {

    private val capabilities = EvaCapabilities(
        { EvaCapabilities.Configuration(true, null, "default") },
        InvocationJournal(
            object : InvocationJournal.Store {
                override fun read(): String? = null
                override fun write(text: String) = Unit
            },
            { 0L },
        ),
        { 0L },
    )

    private fun host(allowed: Boolean = true, executor: Executor = Executor { it.run() }, access: Boolean = true) =
        EvaExtensionHost(capabilities, { allowed }, { 0L }, {}, executor, { access })

    private fun replies(block: ((String) -> Unit) -> Unit): List<JSONObject> {
        val replies = mutableListOf<JSONObject>()
        block { replies.add(JSONObject(it)) }
        return replies
    }

    @Test
    fun untrustedCallerIsRefusedBeforeAnyWork() {
        var ran = false
        val replies = replies { reply ->
            host(allowed = false, executor = Executor { ran = true }).execute(1, "i", "r", "complete_todo", "{}", 10_000, reply)
        }
        assertEquals(1, replies.size)
        assertEquals("unauthorized_caller", replies[0].getString("reasonCode"))
        assertEquals(false, ran)
    }

    @Test
    fun fullQueueRepliesBusyWithWriteState() {
        val replies = replies { reply ->
            host(executor = Executor { throw RejectedExecutionException() })
                .execute(1, "eva-1", "r", "complete_todo", "{}", 10_000, reply)
        }
        assertEquals("busy", replies.single().getString("reasonCode"))
        assertEquals("busy", replies.single().getJSONObject("structuredContent").getString("state"))
    }

    @Test
    fun expiredDeadlineIsNotExecuted() {
        val replies = replies { reply -> host().execute(1, "eva-1", "r", "complete_todo", "{}", 0, reply) }
        assertEquals("not_executed", replies.single().getString("status"))
        assertEquals("deadline_exceeded", replies.single().getString("reasonCode"))
    }

    @Test
    fun optedOutUserRefusesVerifiedEvaWithoutRunning() {
        val write = replies { reply -> host(access = false).execute(1, "eva-1", "r", "complete_todo", """{"id":"a"}""", 10_000, reply) }
        assertEquals("not_executed", write.single().getString("status"))
        assertEquals("not_configured", write.single().getString("reasonCode"))
        assertEquals("needs_authorization", write.single().getJSONObject("structuredContent").getString("state"))

        val described = replies { reply -> host(access = false).describe(1, 5_000, reply) }
        assertEquals("not_configured", described.single().getString("reasonCode"))
    }

    @Test
    fun describeRepliesOnce() {
        val replies = replies { reply -> host().describe(1, 5_000, reply) }
        assertEquals("completed", replies.single().getString("status"))
    }
}
