package com.colonelpanic.mova.eva

import org.json.JSONArray
import org.json.JSONObject

/**
 * Builds the flat input schemas EVA accepts (scalars, scalar arrays and
 * string maps) and validates arguments against the same definitions, so the
 * advertised schema and the enforced one cannot drift apart.
 */
class EvaSchema private constructor(private val properties: List<Property>) {

    sealed class Property(val name: String, val description: String, val required: Boolean) {
        abstract fun toJson(): JSONObject
        abstract fun check(value: Any?): String?
    }

    class Str(
        name: String,
        description: String,
        required: Boolean = false,
        val minLength: Int = 0,
        val maxLength: Int = 500,
        val enum: List<String>? = null,
    ) : Property(name, description, required) {
        override fun toJson(): JSONObject = JSONObject().put("type", "string").put("description", description)
            .put("minLength", minLength).put("maxLength", maxLength)
            .apply { enum?.let { put("enum", JSONArray(it)) } }

        override fun check(value: Any?): String? {
            if (value !is String) return "must be a string"
            val length = value.codePointCount(0, value.length)
            if (length < minLength || length > maxLength) return "must be $minLength to $maxLength characters"
            if (enum != null && value !in enum) return "must be one of ${enum.joinToString(", ")}"
            return null
        }
    }

    class Int64(
        name: String,
        description: String,
        required: Boolean = false,
        val minimum: Long,
        val maximum: Long,
    ) : Property(name, description, required) {
        override fun toJson(): JSONObject = JSONObject().put("type", "integer").put("description", description)
            .put("minimum", minimum).put("maximum", maximum)

        override fun check(value: Any?): String? {
            val n = when (value) {
                is Int -> value.toLong()
                is Long -> value
                else -> return "must be an integer"
            }
            return if (n < minimum || n > maximum) "must be between $minimum and $maximum" else null
        }
    }

    class Bool(name: String, description: String) : Property(name, description, false) {
        override fun toJson(): JSONObject = JSONObject().put("type", "boolean").put("description", description)
        override fun check(value: Any?): String? = if (value is Boolean) null else "must be a boolean"
    }

    class StrArray(name: String, description: String, val maxItems: Int, val maxLength: Int) :
        Property(name, description, false) {
        override fun toJson(): JSONObject = JSONObject().put("type", "array").put("description", description)
            .put("items", JSONObject().put("type", "string").put("minLength", 1).put("maxLength", maxLength))
            .put("minItems", 0).put("maxItems", maxItems)

        override fun check(value: Any?): String? {
            if (value !is JSONArray) return "must be an array of strings"
            if (value.length() > maxItems) return "must have at most $maxItems items"
            for (i in 0 until value.length()) {
                val item = value.opt(i)
                if (item !is String || item.isEmpty() || item.codePointCount(0, item.length) > maxLength) {
                    return "items must be nonempty strings of at most $maxLength characters"
                }
            }
            return null
        }
    }

    class StrMap(name: String, description: String, val maxProperties: Int, val maxLength: Int) :
        Property(name, description, false) {
        override fun toJson(): JSONObject = JSONObject().put("type", "object").put("description", description)
            .put("additionalProperties", JSONObject().put("type", "string").put("maxLength", maxLength))
            .put("maxProperties", maxProperties)

        override fun check(value: Any?): String? {
            if (value !is JSONObject) return "must be an object of strings"
            if (value.length() > maxProperties) return "must have at most $maxProperties entries"
            for (key in value.keys()) {
                if (key.isEmpty() || key.length > 64) return "keys must be 1 to 64 characters"
                val item = value.opt(key)
                if (item !is String || item.codePointCount(0, item.length) > maxLength) {
                    return "values must be strings of at most $maxLength characters"
                }
            }
            return null
        }
    }

    fun toJson(): JSONObject {
        val props = JSONObject()
        properties.forEach { props.put(it.name, it.toJson()) }
        return JSONObject()
            .put("type", "object")
            .put("properties", props)
            .put("required", JSONArray(properties.filter { it.required }.map { it.name }))
            .put("additionalProperties", false)
    }

    /** Returns a human-readable problem, or null when [args] match. */
    fun check(args: JSONObject): String? {
        val known = properties.associateBy { it.name }
        for (key in args.keys()) {
            if (key !in known) return "Unknown argument '$key'"
        }
        for (property in properties) {
            if (!args.has(property.name)) {
                if (property.required) return "Missing required argument '${property.name}'"
                continue
            }
            property.check(args.opt(property.name))?.let { return "Argument '${property.name}' $it" }
        }
        return null
    }

    companion object {
        fun of(vararg properties: Property) = EvaSchema(properties.toList())
    }
}
