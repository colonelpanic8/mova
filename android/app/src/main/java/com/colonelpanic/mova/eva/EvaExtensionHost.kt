package com.colonelpanic.mova.eva

import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Admission, deadlines and reply discipline for the binder service, free of
 * Android types so it runs on the JVM. Binder threads only authenticate and
 * enqueue; every request gets exactly one reply.
 */
class EvaExtensionHost(
    private val capabilities: EvaCapabilities,
    private val callerAllowed: (uid: Int) -> Boolean,
    private val now: () -> Long,
    private val onDataChanged: () -> Unit,
    private val executor: Executor = boundedExecutor(),
    /** The user's opt-out from Mova's default trust in EVA. */
    private val accessEnabled: () -> Boolean = { true },
) {
    fun describe(callingUid: Int, deadline: Long, reply: (String) -> Unit) {
        val once = once(reply)
        if (!callerAllowed(callingUid)) {
            once(EvaProtocol.describeFailure(unauthorized()))
            return
        }
        val effectiveDeadline = minOf(deadline, now() + EvaProtocol.DESCRIBE_MAX_MILLIS)
        val work = Runnable {
            once(
                if (now() >= effectiveDeadline) {
                    EvaProtocol.describeFailure(
                        EvaProtocol.notExecuted(EvaProtocol.REASON_DEADLINE_EXCEEDED, "The describe deadline passed before Mova started."),
                    )
                } else if (!accessEnabled()) {
                    EvaProtocol.describeFailure(EvaProtocol.notExecuted(EvaProtocol.REASON_NOT_CONFIGURED, EvaAccess.OFF_TEXT))
                } else {
                    guarded({ EvaProtocol.describeFailure(EvaProtocol.failed("Mova hit an unexpected error.")) }) {
                        capabilities.describe()
                    }
                },
            )
        }
        submit(work) { once(EvaProtocol.describeFailure(busy())) }
    }

    fun execute(
        callingUid: Int,
        invocationId: String,
        expectedRevision: String,
        capability: String,
        argumentsJson: String,
        deadline: Long,
        reply: (String) -> Unit,
    ) {
        val once = once(reply)
        if (!callerAllowed(callingUid)) {
            once(EvaProtocol.executeEnvelope(unauthorized()))
            return
        }
        if (now() >= deadline) {
            once(
                capabilities.rejection(
                    capability, invocationId, EvaProtocol.REASON_DEADLINE_EXCEEDED,
                    "The deadline passed before Mova received the request. Nothing was sent.", EvaCapabilities.STATE_NOT_SENT,
                ),
            )
            return
        }
        val work = Runnable {
            // Read off the Binder thread: the setting lives in encrypted prefs.
            if (!accessEnabled()) {
                once(
                    capabilities.rejection(
                        capability, invocationId, EvaProtocol.REASON_NOT_CONFIGURED, EvaAccess.OFF_TEXT,
                        EvaCapabilities.STATE_NEEDS_AUTHORIZATION,
                    ),
                )
                return@Runnable
            }
            val execution = guarded({
                // Reached only through a bug; a write may have started, so this is not a not_executed.
                EvaCapabilities.Execution(EvaProtocol.executeEnvelope(EvaProtocol.unknown("Mova hit an unexpected error.")))
            }) {
                capabilities.execute(callingUid, invocationId, expectedRevision, capability, argumentsJson, deadline)
            }
            once(execution.envelope)
            if (execution.dataChanged) runCatching(onDataChanged)
        }
        submit(work) {
            once(
                capabilities.rejection(
                    capability, invocationId, EvaProtocol.REASON_BUSY,
                    "Mova is busy with other requests. Nothing was sent.", EvaCapabilities.STATE_BUSY,
                ),
            )
        }
    }

    private fun submit(work: Runnable, rejected: () -> Unit) {
        try {
            executor.execute(work)
        } catch (e: RejectedExecutionException) {
            rejected()
        }
    }

    private inline fun <T> guarded(fallback: () -> T, block: () -> T): T =
        try {
            block()
        } catch (e: Throwable) {
            fallback()
        }

    private fun once(reply: (String) -> Unit): (String) -> Unit {
        val sent = AtomicBoolean(false)
        return { response -> if (sent.compareAndSet(false, true)) reply(response) }
    }

    private fun unauthorized() = EvaProtocol.notExecuted(EvaProtocol.REASON_UNAUTHORIZED_CALLER, "Caller is not authorized.")

    private fun busy() = EvaProtocol.notExecuted(EvaProtocol.REASON_BUSY, "Mova is busy with other requests.")

    companion object {
        private const val MAX_QUEUED_REQUESTS = 4

        fun boundedExecutor(): Executor =
            ThreadPoolExecutor(1, 2, 30, TimeUnit.SECONDS, ArrayBlockingQueue(MAX_QUEUED_REQUESTS)).apply {
                allowCoreThreadTimeOut(true)
            }
    }
}
