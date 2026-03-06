import { Tabs } from "expo-router";

/**
 * Tab bar layout for the authenticated area of the app.
 *
 * Three tabs:
 *  - Dashboard  (/tabs/index)   — analytics overview
 *  - Insights   (/tabs/insights) — swipeable weekly pattern cards
 *  - Review     (/tabs/review)   — repurpose derivative review queue
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f3f4f6",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: {
          backgroundColor: "#ffffff",
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
          color: "#111827",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon label="📊" color={color} />,
          headerTitle: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <TabIcon label="💡" color={color} />,
          headerTitle: "Weekly Insights",
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: "Review",
          tabBarIcon: ({ color }) => <TabIcon label="✍️" color={color} />,
          headerTitle: "Review Queue",
        }}
      />
    </Tabs>
  );
}

/** Minimal emoji tab icon — avoids an icon library dependency. */
function TabIcon({ label, color: _color }: { label: string; color: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}
