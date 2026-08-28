package com.colonelpanic.mova.wear

import android.content.ComponentName
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER
import androidx.wear.protolayout.LayoutElementBuilders.Spacer
import androidx.wear.protolayout.ResourceBuilders.AndroidImageResourceByResId
import androidx.wear.protolayout.ResourceBuilders.ImageResource
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material3.ColorScheme
import androidx.wear.protolayout.material3.Typography.BODY_MEDIUM
import androidx.wear.protolayout.material3.buttonGroup
import androidx.wear.protolayout.material3.icon
import androidx.wear.protolayout.material3.iconButton
import androidx.wear.protolayout.material3.iconEdgeButton
import androidx.wear.protolayout.material3.materialScope
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.modifiers.LayoutModifier
import androidx.wear.protolayout.modifiers.clickable
import androidx.wear.protolayout.modifiers.contentDescription
import androidx.wear.protolayout.types.argb
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
 * Tiles cannot host text or speech input themselves, so the mic edge button
 * opens [VoiceCaptureActivity], which immediately launches the watch's speech
 * recognizer and then submits (or queues) the captured todo.
 *
 * Capture owns the edge button because it is the point of the tile; the
 * assistant and pin shortcuts sit in the main slot. The bottom slot only
 * gives non-edge-button content 48% of the screen width
 * (`BOTTOM_SLOT_OTHER_MARGIN_SIDE_PERCENTAGE`), which is too narrow for a row
 * of minimum-tap-target buttons — they overflow and get clipped off-screen.
 */
class QuickCaptureTileService : TileService() {
  override fun onTileRequest(
    requestParams: RequestBuilders.TileRequest,
  ): ListenableFuture<Tile> {
    val pendingCount = MovaWearStorage.getPendingTodos(this).size
    val configured = MovaWearStorage.getCredentials(this) != null
    val message = when {
      !configured -> "Open phone to sync"
      pendingCount > 0 -> "$pendingCount queued · tap to sync"
      else -> "Add a todo"
    }

    val layout = materialScope(
      context = this,
      deviceConfiguration = requestParams.deviceConfiguration,
      allowDynamicTheme = false,
      defaultColorScheme = MOVA_COLOR_SCHEME,
    ) {
      val voiceCaptureAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(
            this@QuickCaptureTileService,
            VoiceCaptureActivity::class.java,
          ),
        ),
        id = "voice-capture",
      )
      val assistantAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(
            this@QuickCaptureTileService,
            AssistantVoiceActivity::class.java,
          ),
        ),
        id = "assistant-voice",
      )
      val pinAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(
            this@QuickCaptureTileService,
            PinArmActivity::class.java,
          ),
        ),
        id = "pin-arm",
      )

      primaryLayout(
        titleSlot = {
          // The default slot color ignores defaultColorScheme, so pin the
          // brand palette explicitly.
          text(
            "Mova".layoutString,
            color = 0xFFF6F8FA.toInt().argb,
          )
        },
        mainSlot = {
          Column.Builder()
            .setWidth(expand())
            .setHorizontalAlignment(HORIZONTAL_ALIGN_CENTER)
            .addContent(
              text(
                message.layoutString,
                typography = BODY_MEDIUM,
                color = 0xFFB9C2CA.toInt().argb,
                maxLines = 2,
              ),
            )
            .addContent(Spacer.Builder().setHeight(dp(8f)).build())
            .addContent(
              buttonGroup(height = dp(SECONDARY_BUTTON_HEIGHT_DP)) {
                buttonGroupItem {
                  iconButton(
                    onClick = assistantAction,
                    modifier = LayoutModifier.contentDescription("Ask Mova by voice"),
                    width = expand(),
                    height = expand(),
                    iconContent = { icon(protoLayoutResourceId = ASSISTANT_ICON_ID) },
                  )
                }
                buttonGroupItem {
                  iconButton(
                    onClick = pinAction,
                    modifier = LayoutModifier.contentDescription("Pin a reminder"),
                    width = expand(),
                    height = expand(),
                    iconContent = { icon(protoLayoutResourceId = PIN_ICON_ID) },
                  )
                }
              },
            )
            .build()
        },
        bottomSlot = {
          iconEdgeButton(
            onClick = voiceCaptureAction,
            modifier = LayoutModifier.contentDescription("Capture a todo by voice"),
          ) {
            icon(protoLayoutResourceId = MIC_ICON_ID)
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
        .addIdToImageMapping(
          MIC_ICON_ID,
          ImageResource.Builder()
            .setAndroidResourceByResId(
              AndroidImageResourceByResId.Builder()
                .setResourceId(R.drawable.ic_mic)
                .build(),
            )
            .build(),
        )
        .addIdToImageMapping(
          ASSISTANT_ICON_ID,
          ImageResource.Builder()
            .setAndroidResourceByResId(
              AndroidImageResourceByResId.Builder()
                .setResourceId(R.drawable.ic_auto_awesome)
                .build(),
            )
            .build(),
        )
        .addIdToImageMapping(
          PIN_ICON_ID,
          ImageResource.Builder()
            .setAndroidResourceByResId(
              AndroidImageResourceByResId.Builder()
                .setResourceId(R.drawable.ic_pin)
                .build(),
            )
            .build(),
        )
        .build(),
    )

  private companion object {
    const val RESOURCES_VERSION = "4"
    const val MIC_ICON_ID = "mic"
    const val ASSISTANT_ICON_ID = "assistant"
    const val PIN_ICON_ID = "pin"
    const val SECONDARY_BUTTON_HEIGHT_DP = 52f

    // Teal-on-dark brand palette matching the watch app (see res/values/colors.xml).
    private val MOVA_COLOR_SCHEME = ColorScheme(
      primary = 0xFF80CBC4.toInt().argb,
      primaryDim = 0xFF5FB3AB.toInt().argb,
      primaryContainer = 0xFF80CBC4.toInt().argb,
      onPrimary = 0xFF0B141B.toInt().argb,
      onPrimaryContainer = 0xFF0B141B.toInt().argb,
      secondaryContainer = 0xFF243442.toInt().argb,
      onSecondaryContainer = 0xFFF6F8FA.toInt().argb,
      surfaceContainerLow = 0xFF1B2630.toInt().argb,
      surfaceContainer = 0xFF1B2630.toInt().argb,
      surfaceContainerHigh = 0xFF243442.toInt().argb,
      onSurface = 0xFFF6F8FA.toInt().argb,
      onSurfaceVariant = 0xFFB9C2CA.toInt().argb,
      outline = 0xFF37485A.toInt().argb,
      outlineVariant = 0xFF37485A.toInt().argb,
      background = 0xFF101820.toInt().argb,
      onBackground = 0xFFF6F8FA.toInt().argb,
    )
  }
}
