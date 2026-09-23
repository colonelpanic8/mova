package com.colonelpanic.mova

import com.colonelpanic.mova.intents.TodoRef
import java.net.ServerSocket
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MovaClientDeliveryTest {

    private val server = FakeOrgServer()

    @After
    fun tearDown() = server.close()

    private fun complete(client: MovaClient = server.client()) =
        client.complete(TodoRef(id = "abc"), "DONE", null, strict = true)

    private fun err(result: ApiResult<*>): ApiResult.Err = result as ApiResult.Err

    @Test
    fun refusedConnectionIsNotSent() {
        val closedPort = ServerSocket(0).use { it.localPort }
        val result = MovaClient("http://127.0.0.1:$closedPort", "u", "p")
            .complete(TodoRef(id = "abc"), "DONE", null, strict = true)
        assertEquals(Delivery.NOT_SENT, err(result).delivery)
    }

    @Test
    fun postWithoutTimelyAnswerIsUncertain() {
        server.on("/complete", FakeOrgServer.Response(200, """{"status":"completed"}""", delayMillis = 3000))
        val deadline = System.currentTimeMillis() + 1500
        val result = err(complete(server.client { deadline - System.currentTimeMillis() }))
        assertEquals(Delivery.UNCERTAIN, result.delivery)
        assertTrue(result.deadlineExceeded)
        assertEquals(1, server.count("/complete"))
    }

    @Test
    fun exhaustedBudgetSendsNothing() {
        val result = err(complete(server.client { 100 }))
        assertEquals(Delivery.NOT_SENT, result.delivery)
        assertTrue(result.deadlineExceeded)
        assertEquals(0, server.requests.size)
    }

    @Test
    fun serverErrorsAreUncertainButAnsweredRejectionsAreDefinite() {
        server.on("/complete", 500, """{"status":"error","message":"save failed"}""")
        assertEquals(Delivery.UNCERTAIN, err(complete()).delivery)

        server.on("/complete", 409, """{"status":"error","code":"strict_lookup_conflict","message":"No todo"}""")
        err(complete()).let {
            assertEquals(Delivery.REJECTED, it.delivery)
            assertEquals("No todo", it.message)
        }

        server.on("/complete", 200, """{"status":"error","message":"nope"}""")
        assertEquals(Delivery.REJECTED, err(complete()).delivery)

        server.on("/complete", 200, "<html>proxy</html>")
        assertEquals(Delivery.UNCERTAIN, err(complete()).delivery)
    }

    @Test
    fun writesSendStrictAndSucceedOnJson() {
        server.on("/complete", 200, """{"status":"completed","title":"Taxes"}""")
        val result = complete() as ApiResult.Ok
        assertEquals("completed", result.value.getString("status"))
        val sent = server.lastBody("/complete")
        assertEquals("abc", sent.getString("id"))
        assertTrue(sent.getBoolean("strict"))
        assertFalse(sent.has("title"))
    }
}
