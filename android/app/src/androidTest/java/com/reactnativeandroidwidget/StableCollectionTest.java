package com.reactnativeandroidwidget;

import static org.junit.Assert.*;

import android.app.PendingIntent;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ListView;
import android.widget.RemoteViews;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import com.colonelpanic.mova.WidgetHostTestActivity;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 31)
public class StableCollectionTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private Intent collectionIntent(String... keys) {
        ArrayList<Bundle> items = new ArrayList<>();
        Bitmap bitmap = Bitmap.createBitmap(300, 60, Bitmap.Config.ARGB_8888);
        bitmap.eraseColor(Color.LTGRAY);
        RNWidgetImageProvider.writeImage(context, "test.png", bitmap);
        for (String key : keys) {
            Bundle data = new Bundle();
            if (key != null) data.putString("key", key);
            Bundle item = new Bundle();
            item.putBundle("clickActionData", data);
            item.putString("lightImageName", "test.png");
            item.putString("darkImageName", "test.png");
            item.putInt("imageWidth", 300);
            item.putString("clickAction", "OPEN_URI");
            ArrayList<Bundle> areas = new ArrayList<>();
            Bundle area = new Bundle();
            area.putInt("left", 0);
            area.putInt("right", 44);
            area.putInt("height", 60);
            area.putString("clickAction", "COMPLETE_AGENDA_ITEM");
            Bundle ref = new Bundle();
            ref.putString("id", key);
            ref.putString("key", key);
            area.putBundle("clickActionData", ref);
            areas.add(area);
            item.putParcelableArrayList("clickableAreas", areas);
            items.add(item);
        }
        Intent intent = new Intent();
        intent.putExtra("collectionItems", items);
        intent.putExtra("collectionSize", items.size());
        intent.putExtra("widgetName", "AgendaWidget");
        intent.putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, 123);
        return intent;
    }

    private RemoteViews.RemoteCollectionItems collection(String... keys) {
        return RNWidgetStableCollection.build(context, collectionIntent(keys));
    }

    @Test
    public void idsSurviveRemovalAndReordering() {
        RemoteViews.RemoteCollectionItems before = collection("a", "b", "c");
        RemoteViews.RemoteCollectionItems after = collection("c", "b");
        assertTrue(before.hasStableIds());
        assertTrue(after.hasStableIds());
        assertEquals(before.getItemId(2), after.getItemId(0));
        assertEquals(before.getItemId(1), after.getItemId(1));
        assertEquals(2, after.getItemCount());
        assertEquals(0, collection().getItemCount());
        assertFalse(collection("a", "a").hasStableIds());
        assertFalse(collection((String) null).hasStableIds());
    }

    private RemoteViews widget(String... keys) {
        RemoteViews root = new RemoteViews(context.getPackageName(), R.layout.rn_widget);
        RemoteViews list = new RemoteViews(context.getPackageName(), R.layout.rn_widget_list);
        list.removeAllViews(R.id.rn_widget_list_1_wrapper);
        list.setPendingIntentTemplate(R.id.rn_widget_list_0, PendingIntent.getBroadcast(
            context, 101, new Intent("com.colonelpanic.mova.TEST_COMPLETION").setPackage(context.getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        root.removeAllViews(R.id.rn_widget_collection_container);
        RNWidgetStableCollection.addToWidget(context, root, list, 0,
            R.id.rn_widget_list_0, collectionIntent(keys));
        return root;
    }

    @Test
    public void refreshingRowsKeepsTheListAndAdapter() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            AppWidgetHostView host = new AppWidgetHostView(context);
            RemoteViews before = widget("a", "b", "c");
            View root = before.apply(context, host);
            host.addView(root);
            ListView list = root.findViewById(R.id.rn_widget_list_0);
            Object adapter = list.getAdapter();
            assertNotNull(adapter);
            assertEquals(3, list.getCount());
            widget("b", "c").reapply(context, root);
            assertSame(list, root.findViewById(R.id.rn_widget_list_0));
            assertSame(adapter, list.getAdapter());
            assertEquals(2, list.getCount());
            widget().reapply(context, root);
            assertSame(list, root.findViewById(R.id.rn_widget_list_0));
            assertEquals(0, list.getCount());
            widget("d").reapply(context, root);
            assertSame(adapter, list.getAdapter());
            assertEquals(1, list.getCount());
        });
    }
    @Test
    public void completingAScrolledRowSendsItsReferenceAndKeepsScroll() throws Exception {
        exerciseCompletion(false);
    }

    @Test
    public void partialUpdatesKeepScrolledRows() throws Exception {
        exerciseCompletion(true);
    }

    private void awaitGeneration(ActivityScenario<WidgetHostTestActivity> scenario, AppWidgetHostView host, String generation) {
        long deadline = SystemClock.uptimeMillis() + 5000;
        AtomicBoolean applied = new AtomicBoolean();
        while (!applied.get() && SystemClock.uptimeMillis() < deadline) {
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> {
                View container = host.findViewById(R.id.rn_widget_collection_container);
                applied.set(container != null && generation.contentEquals(
                    container.getContentDescription() == null ? "" : container.getContentDescription()));
            });
            if (!applied.get()) SystemClock.sleep(25);
        }
        assertTrue("widget update " + generation, applied.get());
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }

    private void awaitVisibleRows(ActivityScenario<WidgetHostTestActivity> scenario, ListView list, int first) {
        long deadline = SystemClock.uptimeMillis() + 5000;
        AtomicBoolean ready = new AtomicBoolean();
        while (!ready.get() && SystemClock.uptimeMillis() < deadline) {
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> ready.set(list.getFirstVisiblePosition() == first
                && list.getChildCount() > 0 && list.getChildAt(0).getHeight() > 0
                && !list.isLayoutRequested()));
            if (!ready.get()) SystemClock.sleep(25);
        }
        assertTrue("visible rows at " + first, ready.get());
    }

    private void update(int widgetId, String generation, boolean partial, String... keys) {
        RemoteViews views = widget(keys);
        views.setContentDescription(R.id.rn_widget_collection_container, generation);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (partial) manager.partiallyUpdateAppWidget(widgetId, views);
        else manager.updateAppWidget(widgetId, views);
    }

    private void exerciseCompletion(boolean partial) throws Exception {
        LinkedBlockingQueue<Intent> received = new LinkedBlockingQueue<>();
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context ignored, Intent intent) { received.add(intent); }
        };
        context.registerReceiver(receiver, new IntentFilter("com.colonelpanic.mova.TEST_COMPLETION"),
            Context.RECEIVER_EXPORTED);
        String[] keys = new String[30];
        for (int i = 0; i < keys.length; i++) keys[i] = "item-" + i;
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        instrumentation.setInTouchMode(true);
        AppWidgetHostView[] host = new AppWidgetHostView[1];
        AppWidgetHost[] widgetHost = new AppWidgetHost[1];
        int[] widgetId = new int[1];
        ExecutorService executor = Executors.newSingleThreadExecutor();
        ListView[] list = new ListView[1];
        int[] point = new int[2];
        int[] top = new int[1];
        try (ActivityScenario<WidgetHostTestActivity> scenario = ActivityScenario.launch(WidgetHostTestActivity.class)) {
            scenario.onActivity(activity -> {
                widgetHost[0] = new AppWidgetHost(activity, 9147);
                widgetId[0] = widgetHost[0].allocateAppWidgetId();
                AppWidgetManager manager = AppWidgetManager.getInstance(activity);
                assertTrue("Run adb shell appwidget grantbind --package com.colonelpanic.mova --user 0", manager.bindAppWidgetIdIfAllowed(
                    widgetId[0], new ComponentName(activity, WidgetHostTestActivity.Provider.class)));
                host[0] = widgetHost[0].createView(activity, widgetId[0], manager.getAppWidgetInfo(widgetId[0]));
                host[0].setExecutor(executor);
                activity.setContentView(host[0], new ViewGroup.LayoutParams(300, 240));
                widgetHost[0].startListening();
                update(widgetId[0], "initial", false, keys);
            });
            awaitGeneration(scenario, host[0], "initial");
            scenario.onActivity(activity -> list[0] = host[0].findViewById(R.id.rn_widget_list_0));
            instrumentation.waitForIdleSync();
            awaitVisibleRows(scenario, list[0], 0);
            scenario.onActivity(activity -> list[0].setSelectionFromTop(12, -10));
            awaitVisibleRows(scenario, list[0], 12);
            instrumentation.waitForIdleSync();
            scenario.onActivity(activity -> {
                assertEquals(12, list[0].getFirstVisiblePosition());
                assertTrue(list[0].isInTouchMode());
                View row = list[0].getChildAt(1);
                assertNotNull(row);
                View button = row.findViewById(R.id.rn_widget_clickable_area);
                assertNotNull(button);
                button.getLocationOnScreen(point);
                point[0] += button.getWidth() / 2;
                point[1] += button.getHeight() / 2;
                top[0] = list[0].getChildAt(0).getTop();
            });
            long now = SystemClock.uptimeMillis();
            MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, point[0], point[1], 0);
            instrumentation.sendPointerSync(down);
            down.recycle();
            MotionEvent up = MotionEvent.obtain(now, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0);
            instrumentation.sendPointerSync(up);
            up.recycle();
            Intent completion = received.poll(3, TimeUnit.SECONDS);
            assertNotNull("completion broadcast", completion);
            assertEquals("COMPLETE_AGENDA_ITEM", completion.getStringExtra("clickAction"));
            assertEquals("item-13", completion.getBundleExtra("clickActionData").getString("id"));
            assertEquals(123, completion.getIntExtra("widgetId", -1));
            update(widgetId[0], "pending", partial, keys);
            awaitGeneration(scenario, host[0], "pending");
            scenario.onActivity(activity -> {
                assertSame("pending list instance", list[0], host[0].findViewById(R.id.rn_widget_list_0));
                assertEquals(30, list[0].getCount());
                assertEquals("pending update scroll", 12, list[0].getFirstVisiblePosition());
                assertEquals(top[0], list[0].getChildAt(0).getTop());
            });
            String[] after = new String[29];
            System.arraycopy(keys, 0, after, 0, 13);
            System.arraycopy(keys, 14, after, 13, 16);
            update(widgetId[0], "completed", partial, after);
            awaitGeneration(scenario, host[0], "completed");
            scenario.onActivity(activity -> {
                assertSame("completed list instance", list[0], host[0].findViewById(R.id.rn_widget_list_0));
                assertEquals(29, list[0].getCount());
                assertEquals("completion update scroll", 12, list[0].getFirstVisiblePosition());
                assertEquals(top[0], list[0].getChildAt(0).getTop());
            });
        } finally {
            context.unregisterReceiver(receiver);
            if (widgetHost[0] != null) {
                widgetHost[0].stopListening();
                widgetHost[0].deleteHost();
            }
            executor.shutdownNow();
        }
    }
}
