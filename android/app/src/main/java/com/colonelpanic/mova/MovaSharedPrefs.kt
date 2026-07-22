package com.colonelpanic.mova

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Single access point for the shared preferences used to pass data (including
 * credentials) between the React Native app, the home screen widget and
 * QuickCaptureActivity.
 *
 * Values are stored in EncryptedSharedPreferences backed by an Android
 * Keystore master key. On first access any values found in the legacy
 * plaintext "mova_widget_prefs" file are migrated into the encrypted store
 * and the plaintext file is cleared.
 */
object MovaSharedPrefs {
    private const val TAG = "MovaSharedPrefs"
    private const val LEGACY_PREFS_NAME = "mova_widget_prefs"
    private const val ENCRYPTED_PREFS_NAME = "mova_widget_prefs_secure"

    @Volatile
    private var instance: SharedPreferences? = null

    fun get(context: Context): SharedPreferences {
        return instance ?: synchronized(this) {
            instance ?: create(context.applicationContext).also { instance = it }
        }
    }

    private fun create(context: Context): SharedPreferences {
        val encrypted = createEncrypted(context)
        migrateLegacy(context, encrypted)
        return encrypted
    }

    private fun createEncrypted(context: Context): SharedPreferences {
        return try {
            buildEncrypted(context)
        } catch (e: Exception) {
            // The encrypted file can become unreadable if the keystore entry is
            // lost (e.g. restored from a backup onto another device). Reset the
            // store rather than permanently crashing widget capture.
            Log.w(TAG, "Encrypted prefs unreadable, resetting store", e)
            context.deleteSharedPreferences(ENCRYPTED_PREFS_NAME)
            buildEncrypted(context)
        }
    }

    private fun buildEncrypted(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            ENCRYPTED_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private fun migrateLegacy(context: Context, encrypted: SharedPreferences) {
        val legacy = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        val entries = legacy.all
        if (entries.isEmpty()) {
            return
        }

        val editor = encrypted.edit()
        for ((key, value) in entries) {
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> @Suppress("UNCHECKED_CAST") editor.putStringSet(key, value as Set<String>)
            }
        }
        if (editor.commit()) {
            legacy.edit().clear().commit()
            Log.i(TAG, "Migrated ${entries.size} entries from plaintext prefs to encrypted storage")
        } else {
            Log.w(TAG, "Failed to migrate legacy prefs to encrypted storage; keeping legacy file")
        }
    }
}
