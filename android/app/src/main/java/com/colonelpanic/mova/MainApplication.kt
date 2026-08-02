package com.colonelpanic.mova

import android.app.Application
import android.content.res.Configuration

import androidx.appfunctions.service.AppFunctionConfiguration
import com.colonelpanic.mova.appfunctions.MovaAppFunctions

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication, AppFunctionConfiguration.Provider {

  // Tells the androidx.appfunctions runtime how to construct the class that hosts Mova's
  // @AppFunction methods. MovaAppFunctions is stateless and reads everything it needs (server
  // URL + credentials) from the AppFunctionContext at call time.
  override val appFunctionConfiguration: AppFunctionConfiguration =
    AppFunctionConfiguration.Builder()
      .addEnclosingClassFactory(MovaAppFunctions::class.java) { MovaAppFunctions() }
      .build()


  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SharedStoragePackage())
          add(WearSyncPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
