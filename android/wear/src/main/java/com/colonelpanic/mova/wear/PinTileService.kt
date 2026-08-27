package com.colonelpanic.mova.wear

import android.content.ComponentName
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.LayoutElementBuilders.Spacer
import androidx.wear.protolayout.ResourceBuilders.AndroidImageResourceByResId
import androidx.wear.protolayout.ResourceBuilders.ImageResource
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material3.ColorScheme
import androidx.wear.protolayout.material3.MaterialScope
import androidx.wear.protolayout.material3.Typography.BODY_SMALL
import androidx.wear.protolayout.material3.card
import androidx.wear.protolayout.material3.icon
import androidx.wear.protolayout.material3.iconEdgeButton
import androidx.wear.protolayout.material3.materialScope
import androidx.wear.protolayout.material3.primaryLayout
import androidx.wear.protolayout.material3.text
import androidx.wear.protolayout.modifiers.LayoutModifier
import androidx.wear.protolayout.modifiers.background
import androidx.wear.protolayout.modifiers.clickable
import androidx.wear.protolayout.modifiers.clip
import androidx.wear.protolayout.modifiers.contentDescription
import androidx.wear.protolayout.types.argb
import androidx.wear.protolayout.types.layoutString
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.RequestBuilders.ResourcesRequest
import androidx.wear.tiles.TileBuilders.Tile
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import java.util.concurrent.Executors

/**
 * Dedicated Wear OS Tile for pins: each preset is a chip directly on the
 * tile, so arming a "don't forget" state is a single tap from the carousel.
 * The tap fires a [ActionBuilders.LoadAction]; this service sends the arm
 * request to the phone during the resulting request and renders the outcome
 * in place. The edge button opens [PinArmActivity] for freeform voice pins.
 */
class PinTileService : TileService() {
  private val executor =
    MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor())

  override fun onTileRequest(
    requestParams: RequestBuilders.TileRequest,
  ): ListenableFuture<Tile> {
    val clickedId = requestParams.currentState.lastClickableId
    val deviceConfiguration = requestParams.deviceConfiguration
    return executor.submit<Tile> { buildTile(clickedId, deviceConfiguration) }
  }

  private fun buildTile(
    clickedId: String,
    deviceConfiguration: androidx.wear.protolayout.DeviceParametersBuilders.DeviceParameters,
  ): Tile {
    var presets = MovaWearStorage.getPinPresets(this)
    if (presets.isEmpty() && PinPresetFetcher.fetchIntoStorage(this)) {
      presets = MovaWearStorage.getPinPresets(this)
    }

    val status: PinStatus? = if (clickedId.startsWith(ARM_PREFIX)) {
      val index = clickedId.removePrefix(ARM_PREFIX).toIntOrNull()
      val preset = index?.let { presets.getOrNull(it) }
      when {
        preset == null -> null
        PinSender.send(this, preset.title, preset.minutes) -> PinStatus.Sent(preset.title)
        else -> PinStatus.Failed
      }
    } else {
      null
    }

    val layout = materialScope(
      context = this,
      deviceConfiguration = deviceConfiguration,
      allowDynamicTheme = false,
      defaultColorScheme = MOVA_COLOR_SCHEME,
    ) {
      val voicePinAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(this@PinTileService, PinArmActivity::class.java),
        ),
        id = "voice-pin",
      )

      primaryLayout(
        titleSlot = {
          text(
            when (status) {
              is PinStatus.Sent -> "Pinned ✓"
              PinStatus.Failed -> "Phone unreachable"
              null -> "Pins"
            }.layoutString,
            color = when (status) {
              PinStatus.Failed -> 0xFFF2B85C
              else -> 0xFFF6F8FA
            }.toInt().argb,
          )
        },
        mainSlot = {
          if (presets.isEmpty()) {
            text(
              "Open Mova on phone to sync".layoutString,
              typography = BODY_SMALL,
              color = 0xFFB9C2CA.toInt().argb,
            )
          } else {
            presetColumn(presets.take(MAX_TILE_PRESETS), status)
          }
        },
        bottomSlot = {
          iconEdgeButton(
            onClick = voicePinAction,
            modifier = LayoutModifier.contentDescription("Pin a custom reminder"),
          ) {
            icon(protoLayoutResourceId = MIC_ICON_ID)
          }
        },
      )
    }

    return Tile.Builder()
      .setResourcesVersion(RESOURCES_VERSION)
      .setTileTimeline(Timeline.fromLayoutElement(layout))
      .build()
  }

  private fun MaterialScope.presetColumn(
    presets: List<WearPinPreset>,
    status: PinStatus?,
  ): LayoutElement {
    val justPinned = (status as? PinStatus.Sent)?.title
    val column = Column.Builder()
      .setWidth(expand())
      .setHorizontalAlignment(HORIZONTAL_ALIGN_CENTER)
    presets.forEachIndexed { index, preset ->
      if (index > 0) {
        column.addContent(Spacer.Builder().setHeight(dp(6f)).build())
      }
      column.addContent(presetChip(index, preset, highlight = preset.title == justPinned))
    }
    return column.build()
  }

  private fun MaterialScope.presetChip(
    index: Int,
    preset: WearPinPreset,
    highlight: Boolean,
  ): LayoutElement {
    val armAction = clickable(
      action = ActionBuilders.LoadAction.Builder().build(),
      id = "$ARM_PREFIX$index",
    )
    val label = if (preset.minutes > 0) "${preset.title} · ${preset.minutes}m" else preset.title
    return card(
      onClick = armAction,
      width = expand(),
      // The generic card draws no fill on its own; give each chip an explicit
      // surface (primary-tinted right after its pin was armed).
      modifier = LayoutModifier
        .background((if (highlight) 0xFF5FB3AB else 0xFF243442).toInt().argb)
        .clip(18f)
        .contentDescription("Pin ${preset.title}"),
    ) {
      text(
        label.layoutString,
        typography = BODY_SMALL,
        color = (if (highlight) 0xFF0B141B else 0xFFF6F8FA).toInt().argb,
        maxLines = 1,
      )
    }
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
        .build(),
    )

  private sealed interface PinStatus {
    data class Sent(val title: String) : PinStatus
    data object Failed : PinStatus
  }

  private companion object {
    const val RESOURCES_VERSION = "1"
    const val MIC_ICON_ID = "mic"
    const val ARM_PREFIX = "arm:"
    const val MAX_TILE_PRESETS = 3

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
      surfaceContainer = 0xFF243442.toInt().argb,
      surfaceContainerHigh = 0xFF2E4150.toInt().argb,
      onSurface = 0xFFF6F8FA.toInt().argb,
      onSurfaceVariant = 0xFFB9C2CA.toInt().argb,
      outline = 0xFF37485A.toInt().argb,
      outlineVariant = 0xFF37485A.toInt().argb,
      background = 0xFF101820.toInt().argb,
      onBackground = 0xFFF6F8FA.toInt().argb,
    )
  }
}
