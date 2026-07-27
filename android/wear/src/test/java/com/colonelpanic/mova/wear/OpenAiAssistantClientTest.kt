package com.colonelpanic.mova.wear

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenAiAssistantClientTest {
  @Test
  fun `extracts function calls and ignores other output items`() {
    val response = JSONObject().put(
      "output",
      JSONArray()
        .put(JSONObject().put("type", "reasoning").put("id", "rs_1"))
        .put(
          JSONObject()
            .put("type", "function_call")
            .put("call_id", "call_1")
            .put("name", "get_agenda")
            .put("arguments", """{"date":"2026-07-27"}"""),
        ),
    )

    val calls = OpenAiAssistantClient.functionCalls(response)

    assertEquals(1, calls.size)
    assertEquals("get_agenda", calls.single().getString("name"))
  }

  @Test
  fun `joins output text from assistant messages`() {
    val response = JSONObject().put(
      "output",
      JSONArray().put(
        JSONObject()
          .put("type", "message")
          .put(
            "content",
            JSONArray()
              .put(JSONObject().put("type", "output_text").put("text", "Done."))
              .put(JSONObject().put("type", "output_text").put("text", "One task completed.")),
          ),
      ),
    )

    assertEquals(
      "Done.\nOne task completed.",
      OpenAiAssistantClient.outputText(response),
    )
  }

  @Test
  fun `tool catalog exposes focused operations and an allowlisted fallback`() {
    val definitions = OrgAgendaAssistantTools.definitions()
    val names = (0 until definitions.length()).map {
      definitions.getJSONObject(it).getString("name")
    }

    assertTrue("search_todos" in names)
    assertTrue("complete_todo" in names)
    assertTrue("call_org_agenda_api" in names)

    val generic = (0 until definitions.length())
      .map { definitions.getJSONObject(it) }
      .single { it.getString("name") == "call_org_agenda_api" }
    val endpoints = generic
      .getJSONObject("parameters")
      .getJSONObject("properties")
      .getJSONObject("endpoint")
      .getJSONArray("enum")
    val endpointNames = (0 until endpoints.length()).map(endpoints::getString)

    assertTrue("/add-clock" in endpointNames)
    assertTrue("/all-habit-statuses" in endpointNames)
    assertTrue("/category-tasks" in endpointNames)
    assertTrue("/trigger-sync" in endpointNames)
    assertTrue("/complete" !in endpointNames)
    assertTrue("/restart" !in endpointNames)
  }
}
