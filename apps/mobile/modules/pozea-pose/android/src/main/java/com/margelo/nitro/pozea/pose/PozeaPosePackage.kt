package com.margelo.nitro.pozea.pose

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Autolinking entry point. It only loads the native library; the HybridObject is created from JS. */
class PozeaPosePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { HashMap() }

  companion object {
    init {
      PozeaPoseOnLoad.initializeNative()
    }
  }
}
