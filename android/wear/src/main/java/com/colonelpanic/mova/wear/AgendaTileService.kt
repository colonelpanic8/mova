package com.colonelpanic.mova.wear

import android.content.ComponentName
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.HORIZONTAL_ALIGN_START
import androidx.wear.protolayout.ResourceBuilders.AndroidImageResourceByResId
import androidx.wear.protolayout.ResourceBuilders.ImageResource
import androidx.wear.protolayout.ResourceBuilders.Resources
import androidx.wear.protolayout.TimelineBuilders.Timeline
import androidx.wear.protolayout.material3.ColorScheme
import androidx.wear.protolayout.material3.Typography.BODY_SMALL
import androidx.wear.protolayout.material3.Typography.LABEL_SMALL
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
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import java.util.concurrent.Executors

/**
 * Swipe-accessible Wear OS Tile that surfaces the top of today's agenda and
 * lets you tick items off in place. Tapping an item card completes it (via a
 * [ActionBuilders.LoadAction] that this service handles on the next request);
 * the edge button opens [AgendaActivity] for the full, scrollable day.
 *
 * Network work runs on a background executor so [onTileRequest] can fetch the
 * live agenda (and perform a completion) before returning the rendered tile.
 */
class AgendaTileService : TileService() {
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
    val credentials = MovaWearStorage.getCredentials(this)

    val state: AgendaTileState = if (credentials == null) {
      AgendaTileState.NotConfigured
    } else {
      // A tapped item card carries a "done:<key>" id; complete it first, then
      // reload so the tile reflects the item dropping off (or a habit's reset).
      if (clickedId.startsWith(DONE_PREFIX)) {
        val key = clickedId.removePrefix(DONE_PREFIX)
        AgendaClient.getAgenda(credentials).items
          .firstOrNull { it.key == key && !it.completedToday }
          ?.let { AgendaClient.complete(credentials, it) }
      }
      val result = AgendaClient.getAgenda(credentials)
      if (result.success) {
        AgendaTileState.Loaded(result.items.filter { !it.completedToday })
      } else {
        AgendaTileState.Error(result.message)
      }
    }

    val layout = materialScope(
      context = this,
      deviceConfiguration = deviceConfiguration,
      allowDynamicTheme = false,
      defaultColorScheme = MOVA_COLOR_SCHEME,
    ) {
      val openAgendaAction = clickable(
        action = ActionBuilders.launchAction(
          ComponentName(this@AgendaTileService, AgendaActivity::class.java),
        ),
        id = "open-agenda",
      )

      val title = when (state) {
        is AgendaTileState.Loaded ->
          if (state.items.isEmpty()) "Today" else "Today · ${state.items.size}"
        else -> "Today"
      }

      primaryLayout(
        titleSlot = {
          text(title.layoutString, color = 0xFFF6F8FA.toInt().argb)
        },
        mainSlot = {
          when (state) {
            is AgendaTileState.NotConfigured ->
              centeredMessage("Open Mova on phone to sync")
            is AgendaTileState.Error ->
              centeredMessage(state.message)
            is AgendaTileState.Loaded ->
              if (state.items.isEmpty()) {
                centeredMessage("All clear ✓")
              } else {
                agendaColumn(state.items.take(MAX_TILE_ITEMS))
              }
          }
        },
        bottomSlot = {
          iconEdgeButton(
            onClick = openAgendaAction,
            modifier = LayoutModifier.contentDescription("Open today's full agenda"),
          ) {
            icon(protoLayoutResourceId = LIST_ICON_ID)
          }
        },
      )
    }

    return Tile.Builder()
      .setResourcesVersion(RESOURCES_VERSION)
      .setTileTimeline(Timeline.fromLayoutElement(layout))
      .build()
  }

  private fun androidx.wear.protolayout.material3.MaterialScope.centeredMessage(
    message: String,
  ) = text(message.layoutString, typography = BODY_SMALL, color = 0xFFB9C2CA.toInt().argb)

  private fun androidx.wear.protolayout.material3.MaterialScope.agendaColumn(
    items: List<AgendaItem>,
  ): androidx.wear.protolayout.LayoutElementBuilders.LayoutElement {
    val column = Column.Builder()
      .setWidth(expand())
      .setHorizontalAlignment(HORIZONTAL_ALIGN_START)
    items.forEachIndexed { index, item ->
      if (index > 0) {
        column.addContent(
          androidx.wear.protolayout.LayoutElementBuilders.Spacer.Builder()
            .setHeight(androidx.wear.protolayout.DimensionBuilders.dp(6f))
            .build(),
        )
      }
      column.addContent(agendaCard(item))
    }
    return column.build()
  }

  private fun androidx.wear.protolayout.material3.MaterialScope.agendaCard(
    item: AgendaItem,
  ): androidx.wear.protolayout.LayoutElementBuilders.LayoutElement {
    val doneAction = clickable(
      action = ActionBuilders.LoadAction.Builder().build(),
      id = "$DONE_PREFIX${item.key}",
    )
    val meta = buildString {
      when {
        item.isOverdue -> append("Overdue")
        item.timeLabel != null -> append(item.timeLabel)
      }
      if (item.isHabit) {
        if (isNotEmpty()) append(" · ")
        append("Habit")
      }
    }
    return card(
      onClick = doneAction,
      width = expand(),
      // The generic card draws no fill on its own, so give each row an explicit
      // surface background and rounded clip to read as a distinct, tappable item.
      modifier = LayoutModifier
        .background(0xFF243442.toInt().argb)
        .clip(18f)
        .contentDescription("Complete ${item.title}"),
    ) {
      val content = Column.Builder()
        .setWidth(expand())
        .setHorizontalAlignment(HORIZONTAL_ALIGN_START)
        .addContent(
          text(
            item.title.layoutString,
            typography = BODY_SMALL,
            color = 0xFFF6F8FA.toInt().argb,
            maxLines = 2,
          ),
        )
      if (meta.isNotEmpty()) {
        content.addContent(
          text(
            meta.layoutString,
            typography = LABEL_SMALL,
            color = (if (item.isOverdue) 0xFFF2B85C else 0xFFB9C2CA).toInt().argb,
          ),
        )
      }
      content.build()
    }
  }

  override fun onTileResourcesRequest(
    requestParams: ResourcesRequest,
  ): ListenableFuture<Resources> =
    com.google.common.util.concurrent.Futures.immediateFuture(
      Resources.Builder()
        .setVersion(RESOURCES_VERSION)
        .addIdToImageMapping(
          LIST_ICON_ID,
          ImageResource.Builder()
            .setAndroidResourceByResId(
              AndroidImageResourceByResId.Builder()
                .setResourceId(R.drawable.ic_list)
                .build(),
            )
            .build(),
        )
        .build(),
    )

  private sealed interface AgendaTileState {
    data object NotConfigured : AgendaTileState
    data class Error(val message: String) : AgendaTileState
    data class Loaded(val items: List<AgendaItem>) : AgendaTileState
  }

  private companion object {
    const val RESOURCES_VERSION = "1"
    const val LIST_ICON_ID = "list"
    const val DONE_PREFIX = "done:"
    const val MAX_TILE_ITEMS = 2

    // Teal-on-dark brand palette matching the watch app (see res/values/colors.xml).
    private val MOVA_COLOR_SCHEME = ColorScheme(
      primary = 0xFF80CBC4.toInt().argb,
      primaryDim = 0xFF5FB3AB.toInt().argb,
      primaryContainer = 0xFF80CBC4.toInt().argb,
      onPrimary = 0xFF0B141B.toInt().argb,
      onPrimaryContainer = 0xFF0B141B.toInt().argb,
      secondaryContainer = 0xFF243442.toInt().argb,
      onSecondaryContainer = 0xFFF6F8FA.toInt().argb,
      // Cards on the tile read against the near-black background, so lift the
      // container shades so each agenda row is clearly a distinct surface.
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
