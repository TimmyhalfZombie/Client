// client/utils/clearDemoData.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Clear all demo data and local storage
 * This ensures only database data is shown
 */
export async function clearAllDemoData() {
  try {
    // Clear activity data
    await AsyncStorage.removeItem("ACTIVITY_STORAGE_KEY");
    
    // Clear any other potential demo data
    const keys = await AsyncStorage.getAllKeys();
    const demoKeys = keys.filter(key => 
      key.includes("demo") || 
      key.includes("seed") || 
      key.includes("sample")
    );
    
    if (demoKeys.length > 0) {
      await AsyncStorage.multiRemove(demoKeys);
    }
    
    console.log("✅ All demo data cleared - only database data will be shown");
  } catch (error) {
    console.error("Error clearing demo data:", error);
  }
}
