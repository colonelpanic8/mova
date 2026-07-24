package com.colonelpanic.mova.wear

import android.content.ComponentName
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material3.Typography.BODY_MEDIUM
import androidx.wear.protolayout.material3.materialScope
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.material3.textEdgeButton
import androidx.wear.protolayout.modifiers.LayoutModifier
import androidx.wear.protolayout.modifiers.clickable
import androidx.wear.protolayout.modifiers.contentDescription
import androidx.wear.protolayout.types.layoutString
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Swipe-accessible Wear OS Tile for Mova's fastest watch workflow.
 *
 * Tiles cannot host text or speech input themselves, so the primary action
 * opens [VoiceCaptureActivity], which immediately launches the watch's speech
 * recognizer and then submits (or queues) the captured todo.
 */
class QuickCaptureTileService : TileService() {
  override fun onTileRequest(
    requestParams: RequestBuilders.TileRequest,
  ): ListenableFuture<Tile> {
    val pendingCount = MovaWearStorage.getPendingTodos(this).size
    val configured = MovaWearStorage.getCredentials(this) != null
    val message = when {
      !configured -> "Open Mova on your phone once to sync settings"
      pendingCount > 0 -> "$pendingCount capture${if (pendingCount == 1) "" else "s"} queued"
      else -> "Add a todo without opening the app"
    }

    val layout = materialScope(this, requestParams.deviceConfiguration) {
      val voiceCaptureAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(
            this@QuickCaptureTileService,
            VoiceCaptureActivity::class.java,
          ),
        ),
        id = "voice-capture",
      )

      primaryLayout(
        titleSlot = {
          text("Mova".layoutString)
        },
        mainSlot = {
          text(
            message.layoutString,
            typography = BODY_MEDIUM,
          )
        },
        bottomSlot = {
          textEdgeButton(
            onClick = voiceCaptureAction,
            modifier = LayoutModifier.contentDescription("Capture a todo by voice"),
          ) {
            text("Capture".layoutString)
          }
        },
      )
    }

    return Futures.immediateFuture(
      Tile.Builder()
        .setResourcesVersion(RESOURCES_VERSION)
        .setTileTimeline(Timeline.fromLayoutElement(layout))
        .build(),
    )
  }

  override fun onTileResourcesRequest(
    requestParams: ResourcesRequest,
  ): ListenableFuture<Resources> =
    Futures.immediateFuture(
      Resources.Builder()
        .setVersion(RESOURCES_VERSION)
        .build(),
    )

  private companion object {
    const val RESOURCES_VERSION = "1"
  }
}
