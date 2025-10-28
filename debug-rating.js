// Debug script to test rating functionality
// Run this in your browser console or add to your app temporarily

async function debugRating(assistRequestId) {
  try {
    console.log("🔍 Debugging rating for assist request:", assistRequestId);
    
    // 1. Check assist request status
    const debugResponse = await fetch(`http://localhost:3000/api/assist/${assistRequestId}/debug`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await AsyncStorage.getItem("token")}`
      }
    });
    
    const debugData = await debugResponse.json();
    console.log("📋 Assist Request Debug Info:", debugData);
    
    if (!debugData.success) {
      console.error("❌ Debug failed:", debugData.msg);
      return;
    }
    
    const { status, assignedTo, alreadyRated } = debugData.data;
    
    // 2. Check if request can be rated
    if (status !== "done") {
      console.error(`❌ Cannot rate - Status is "${status}", needs to be "done"`);
      console.log("💡 To fix: Update the assist request status to 'done' in the database");
      return;
    }
    
    if (!assignedTo) {
      console.error("❌ Cannot rate - No operator assigned");
      return;
    }
    
    if (alreadyRated) {
      console.error("❌ Cannot rate - Already rated");
      return;
    }
    
    console.log("✅ Request is ready for rating!");
    
    // 3. Test rating submission
    const ratingResponse = await fetch(`http://localhost:3000/api/assist/${assistRequestId}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await AsyncStorage.getItem("token")}`
      },
      body: JSON.stringify({
        rating: 5,
        comment: "Test rating from debug script"
      })
    });
    
    const ratingData = await ratingResponse.json();
    console.log("⭐ Rating Response:", ratingData);
    
    if (ratingData.success) {
      console.log("✅ Rating submitted successfully!");
    } else {
      console.error("❌ Rating failed:", ratingData.msg);
    }
    
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
}

// Usage: debugRating("your-assist-request-id-here")
console.log("🔧 Debug script loaded. Use: debugRating('your-assist-request-id')");
