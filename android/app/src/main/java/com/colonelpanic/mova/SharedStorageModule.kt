package com.colonelpanic.mova

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module to access shared preferences for widget communication.
 * This allows data to be shared between the main app and the widget
 * which runs in a separate process.
 *
 * Backed by [MovaSharedPrefs] (EncryptedSharedPreferences).
 */
class SharedStorageModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SharedStorage"

    private val prefs
        get() = MovaSharedPrefs.get(reactApplicationContext)

    @ReactMethod
    fun setItem(key: String, value: String, promise: Promise) {
        try {
            prefs.edit().putString(key, value).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getItem(key: String, promise: Promise) {
        try {
            promise.resolve(prefs.getString(key, null))
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun removeItem(key: String, promise: Promise) {
        try {
            prefs.edit().remove(key).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clear(promise: Promise) {
        try {
            prefs.edit().clear().apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }
}
