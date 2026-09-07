package com.reactnativeandroidwidget;

import android.appwidget.AppWidgetHostView;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ListView;
import android.widget.RemoteViews;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.ArrayList;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 31)
public class StableCollectionTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private RemoteViews.RemoteCollectionItems collection(String... keys) {
        ArrayList<Bundle> items = new ArrayList<>();
        for (String key : keys) {
            Bundle data = new Bundle();
            if (key != null) data.putString("key", key);
            Bundle item = new Bundle();
            item.putBundle("clickActionData", data);
            item.putString("lightImageName", "test.png");
            item.putString("darkImageName", "test.png");
            item.putParcelableArrayList("clickableAreas", new ArrayList<Bundle>());
            items.add(item);
        }
        Intent intent = new Intent();
        intent.putExtra("collectionItems", items);
        intent.putExtra("collectionSize", items.size());
        return RNWidgetStableCollection.build(context, intent);
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
        list.setRemoteAdapter(R.id.rn_widget_list_0, collection(keys));
        root.removeAllViews(R.id.rn_widget_collection_container);
        root.addStableView(R.id.rn_widget_collection_container, list, 0);
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
}
