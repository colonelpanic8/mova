package com.colonelpanic.mova.eva

import android.content.Context
import com.colonelpanic.mova.BuildConfig
import com.colonelpanic.mova.MovaSharedPrefs

/**
 * Mova trusts the verified EVA app by default: it may use the extension
 * service and the content provider without Mova's Android permissions. The
 * user can turn this off in settings; other apps are never affected.
 */
object EvaAccess {
    /** Written by the settings screen; only "false" opts out. */
    const val PREF_EVA_ACCESS = "mova_eva_access"

    const val OFF_TEXT = "EVA access is turned off in Mova's settings. Turn on \"Let EVA use Mova\" to allow it. Nothing was sent."

    fun enabled(context: Context): Boolean =
        try {
            MovaSharedPrefs.get(context).getString(PREF_EVA_ACCESS, null) != "false"
        } catch (e: Exception) {
            // Unreadable prefs also hide the login, so nothing can run anyway.
            true
        }

    fun verifier(context: Context) = EvaCallerVerifier(context.packageManager, context.packageName, BuildConfig.DEBUG)

    /** True when [uid] is the verified EVA app and the user has not opted out. */
    fun trusts(context: Context, uid: Int): Boolean = verifier(context).isTrusted(uid) && enabled(context)
}
