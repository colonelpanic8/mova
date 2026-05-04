package com.colonelpanic.mova

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WearSyncPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): MutableList<NativeModule> = mutableListOf(WearSyncModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): MutableList<ViewManager<*, *>> = mutableListOf()
}
