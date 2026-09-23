package com.colonelpanic.mova

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import org.json.JSONObject

/**
 * A local org-agenda-api stand-in recording every request it receives. Plain
 * sockets, because Android unit tests compile against android.jar, which lacks
 * the JDK's HTTP server.
 */
class FakeOrgServer : AutoCloseable {
    data class Response(val status: Int, val body: String, val delayMillis: Long = 0)
    data class Request(val method: String, val path: String, val body: String)

    val requests = CopyOnWriteArrayList<Request>()
    private val routes = mutableMapOf<String, (String) -> Response>()
    private val socket = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))

    init {
        thread(isDaemon = true) {
            while (!socket.isClosed) {
                val client = try {
                    socket.accept()
                } catch (e: Exception) {
                    break
                }
                thread(isDaemon = true) { serve(client) }
            }
        }
    }

    private fun serve(client: Socket) = client.use {
        try {
            val input = BufferedInputStream(client.getInputStream())
            val requestLine = readLine(input)
            var length = 0
            while (true) {
                val header = readLine(input)
                if (header.isEmpty()) break
                if (header.startsWith("Content-Length:", ignoreCase = true)) length = header.substringAfter(':').trim().toInt()
            }
            val body = ByteArray(length).also { var read = 0; while (read < length) read += input.read(it, read, length - read) }
            val (method, target) = requestLine.split(" ")
            val path = target.substringBefore('?')
            requests.add(Request(method, path, body.toString(Charsets.UTF_8)))
            val handler = synchronized(routes) { routes[path] }
            val response = handler?.invoke(body.toString(Charsets.UTF_8)) ?: Response(404, """{"status":"error","message":"no route"}""")
            if (response.delayMillis > 0) Thread.sleep(response.delayMillis)
            val bytes = response.body.toByteArray()
            client.getOutputStream().apply {
                write("HTTP/1.1 ${response.status} X\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                write(bytes)
                flush()
            }
        } catch (e: Exception) {
            // The client gave up waiting.
        }
    }

    private fun readLine(input: InputStream): String {
        val out = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b == -1 || b == '\n'.code) break
            if (b != '\r'.code) out.write(b)
        }
        return out.toString("UTF-8")
    }

    val url: String get() = "http://127.0.0.1:${socket.localPort}"

    fun on(path: String, response: Response) = on(path) { _ -> response }

    fun on(path: String, handler: (body: String) -> Response) = synchronized(routes) { routes[path] = handler }

    fun on(path: String, status: Int, body: String) = on(path, Response(status, body))

    fun count(path: String): Int = requests.count { it.path == path }

    fun lastBody(path: String): JSONObject = JSONObject(requests.last { it.path == path }.body)

    fun client(remainingMillis: (() -> Long)? = null) = MovaClient(url, "user", "secret", remainingMillis)

    override fun close() = socket.close()
}
