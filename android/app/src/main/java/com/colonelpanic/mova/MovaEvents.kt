package com.colonelpanic.mova

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.colonelpanic.mova.widget.AgendaWidget
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Tells the rest of the app that native code changed server data: the React
 * Native side (if running) drops its query cache, and agenda widgets redraw.
 */
object MovaEvents {
    private const val TAG = "MovaEvents"
    const val JS_EVENT_DATA_CHANGED = "movaDataChanged"

    fun dataChanged(context: Context) {
        emitToReact(context)
        refreshAgendaWidgets(context)
    }

    private fun emitToReact(context: Context) {
        try {
            val reactContext = (context.applicationContext as? ReactApplication)
                ?.reactHost?.currentReactContext ?: return
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(JS_EVENT_DATA_CHANGED, null)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to notify React Native of data change", e)
        }
    }

    private fun refreshAgendaWidgets(context: Context) {
        try {
            val component = ComponentName(context, AgendaWidget::class.java)
            val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(component)
            if (ids.isEmpty()) return
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                setComponent(component)
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to refresh agenda widgets", e)
        }
    }
}
