// Test the processSubProgramData function
import { processSubProgramData } from "./src/services/apiDataService.js";

console.log("Testing processSubProgramData...");
try {
    const data = await processSubProgramData();
    console.log("Data returned:", data);
    console.log("Data type:", typeof data);
    console.log("Data length:", data ? data.length : "null/undefined");
    if (data && data.length > 0) {
        console.log("First item keys:", Object.keys(data[0]));
        console.log("First item:", data[0]);
    }
} catch (error) {
    console.error("Error:", error);
}
