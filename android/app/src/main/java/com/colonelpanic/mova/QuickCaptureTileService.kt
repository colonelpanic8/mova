package com.colonelpanic.mova

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class QuickCaptureTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            label = getString(R.string.shortcut_capture_long)
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    @Suppress("DEPRECATION")
    override fun onClick() {
        super.onClick()

        val intent = Intent(this, QuickCaptureActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            startActivityAndCollapse(intent)
        }
    }
}
