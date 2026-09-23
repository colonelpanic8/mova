package com.colonelpanic.mova.eva

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.RemoteException
import android.os.SystemClock
import android.os.UserManager
import android.util.AtomicFile
import com.colonelpanic.eva.extension.IEvaExtension
import com.colonelpanic.eva.extension.IEvaExtensionCallback
import com.colonelpanic.mova.BuildConfig
import com.colonelpanic.mova.MovaClient
import com.colonelpanic.mova.MovaEvents
import java.io.File
import java.security.MessageDigest

/**
 * Exported binder EVA discovers through `com.colonelpanic.eva.action.EXTENSION`.
 * Binding cold-starts Mova's process without an activity or the React Native
 * runtime, so it serves requests while the phone is locked after its first
 * unlock. Binder threads only authenticate and enqueue.
 */
class EvaExtensionService : Service() {

    private lateinit var host: EvaExtensionHost

    override fun onCreate() {
        super.onCreate()
        val context = applicationContext
        val verifier = EvaCallerVerifier(packageManager, packageName, BuildConfig.DEBUG)
        host = EvaExtensionHost(
            capabilities(context),
            verifier::isTrusted,
            SystemClock::elapsedRealtime,
            { MovaEvents.dataChanged(context) },
        )
    }

    private val binder = object : IEvaExtension.Stub() {
        override fun describe(
            requestId: String?,
            requestJson: String?,
            deadlineElapsedRealtimeMillis: Long,
            callback: IEvaExtensionCallback?,
        ) {
            if (requestId == null || callback == null) return
            host.describe(Binder.getCallingUid(), deadlineElapsedRealtimeMillis) { deliver(callback, requestId, it) }
        }

        override fun execute(
            invocationId: String?,
            expectedRevision: String?,
            capability: String?,
            argumentsJson: String?,
            deadlineElapsedRealtimeMillis: Long,
            callback: IEvaExtensionCallback?,
        ) {
            if (invocationId == null || callback == null) return
            host.execute(
                Binder.getCallingUid(),
                invocationId,
                expectedRevision.orEmpty(),
                capability.orEmpty(),
                argumentsJson.orEmpty(),
                deadlineElapsedRealtimeMillis,
            ) { deliver(callback, invocationId, it) }
        }
    }

    override fun onBind(intent: Intent?): IBinder = binder

    private fun deliver(callback: IEvaExtensionCallback, requestId: String, responseJson: String) {
        try {
            callback.onResult(requestId, responseJson)
        } catch (e: RemoteException) {
            // EVA stopped waiting; the journal still holds a write's outcome.
        }
    }

    companion object {
        @Volatile
        private var sharedJournal: InvocationJournal? = null

        @Volatile
        private var sharedCapabilities: EvaCapabilities? = null

        /** Shared by this service and TodoProvider.call, so both use one journal and catalog. */
        fun capabilities(context: Context): EvaCapabilities =
            sharedCapabilities ?: synchronized(this) {
                val app = context.applicationContext
                sharedCapabilities ?: EvaCapabilities({ configuration(app) }, journal(app), SystemClock::elapsedRealtime)
                    .also { sharedCapabilities = it }
            }

        /** One journal per process, so in-flight state survives service rebinds. */
        fun journal(context: Context): InvocationJournal =
            sharedJournal ?: synchronized(this) {
                sharedJournal ?: InvocationJournal(
                    AtomicFileStore(File(context.noBackupFilesDir, "eva-invocations.json")),
                    System::currentTimeMillis,
                ).also { sharedJournal = it }
            }

        fun configuration(context: Context): EvaCapabilities.Configuration {
            // Credential-encrypted storage, and with it the stored login, is
            // unreadable until the first unlock after boot. Never touch it
            // before then: MovaSharedPrefs resets a store it cannot decrypt.
            val unlocked = context.getSystemService(UserManager::class.java)?.isUserUnlocked ?: true
            if (!unlocked) return EvaCapabilities.Configuration(false, null, "default")
            return EvaCapabilities.Configuration(
                true,
                MovaClient.fromPrefs(context),
                MovaClient.defaultTemplate(context),
            )
        }
    }
}

private class AtomicFileStore(file: File) : InvocationJournal.Store {
    private val atomic = AtomicFile(file)

    override fun read(): String? =
        if (atomic.baseFile.exists()) atomic.readFully().toString(Charsets.UTF_8) else null

    override fun write(text: String) {
        val stream = atomic.startWrite()
        try {
            stream.write(text.toByteArray(Charsets.UTF_8))
            atomic.finishWrite(stream)
        } catch (e: Exception) {
            atomic.failWrite(stream)
            throw e
        }
    }
}

/**
 * Trusts a calling UID only when every package sharing it is a known EVA
 * package with the expected signer: release EVA by pinned certificate digest,
 * debug EVA (debug Mova builds only) when it shares Mova's own signer.
 */
class EvaCallerVerifier(
    private val packageManager: PackageManager,
    private val selfPackage: String,
    private val debugBuild: Boolean,
) {
    fun isTrusted(uid: Int): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
        val packages = packageManager.getPackagesForUid(uid)?.takeIf { it.isNotEmpty() } ?: return false
        return packages.all(::isTrustedPackage)
    }

    private fun isTrustedPackage(packageName: String): Boolean = when (packageName) {
        EVA_PACKAGE -> packageManager.hasSigningCertificate(packageName, EVA_RELEASE_CERT_SHA256, PackageManager.CERT_INPUT_SHA256)
        EVA_DEBUG_PACKAGE -> debugBuild && ownSigningDigests().any {
            packageManager.hasSigningCertificate(packageName, it, PackageManager.CERT_INPUT_SHA256)
        }
        else -> false
    }

    private fun ownSigningDigests(): List<ByteArray> {
        val info = try {
            packageManager.getPackageInfo(selfPackage, PackageManager.GET_SIGNING_CERTIFICATES)
        } catch (e: PackageManager.NameNotFoundException) {
            return emptyList()
        }
        val signers = info.signingInfo?.apkContentsSigners ?: return emptyList()
        return signers.map { MessageDigest.getInstance("SHA-256").digest(it.toByteArray()) }
    }

    companion object {
        const val EVA_PACKAGE = "com.colonelpanic.eva"
        const val EVA_DEBUG_PACKAGE = "com.colonelpanic.eva.debug"

        /** SHA-256 of EVA's release signing certificate (apksigner on eva v0.26.0). */
        private const val EVA_RELEASE_CERT_SHA256_HEX =
            "688df17827dd9a002705baf0400c80f8f4650c6e87c3fc91d41f32be287f8b68"

        val EVA_RELEASE_CERT_SHA256: ByteArray =
            EVA_RELEASE_CERT_SHA256_HEX.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
}
