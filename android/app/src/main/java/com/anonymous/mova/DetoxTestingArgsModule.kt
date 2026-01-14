package com.anonymous.mova

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeMap

class DetoxTestingArgsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DetoxTestingArgs"

    @ReactMethod
    fun getLaunchArgs(promise: Promise) {
        val launchArgs = WritableNativeMap()

        try {
            val activity = reactContext.currentActivity
            val intent = activity?.intent
            val extras = intent?.extras

            if (extras != null) {
                for (key in extras.keySet()) {
                    val value = extras.getString(key)
                    if (value != null && key.startsWith("detox")) {
                        launchArgs.putString(key, value)
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore errors
        }

        promise.resolve(launchArgs)
    }
}
