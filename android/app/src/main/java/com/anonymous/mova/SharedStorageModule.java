package com.anonymous.mova;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Native module to access SharedPreferences for widget communication.
 * This allows data to be shared between the main app and the widget
 * which runs in a separate process.
 */
public class SharedStorageModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "mova_widget_prefs";

    public SharedStorageModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "SharedStorage";
    }

    private SharedPreferences getPrefs() {
        return getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @ReactMethod
    public void setItem(String key, String value, Promise promise) {
        try {
            SharedPreferences.Editor editor = getPrefs().edit();
            editor.putString(key, value);
            editor.apply();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getItem(String key, Promise promise) {
        try {
            String value = getPrefs().getString(key, null);
            promise.resolve(value);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void removeItem(String key, Promise promise) {
        try {
            SharedPreferences.Editor editor = getPrefs().edit();
            editor.remove(key);
            editor.apply();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clear(Promise promise) {
        try {
            SharedPreferences.Editor editor = getPrefs().edit();
            editor.clear();
            editor.apply();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
