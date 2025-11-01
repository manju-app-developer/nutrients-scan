// /netlify/functions/get-n-score.js
// This function receives aggregated nutritional data from the client
// and asks the AI to generate an N-Score and a fun, insightful message.

exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    // Updated to use the gemini-2.5-flash model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    try {
        // Get the total nutrition data and food names from the client
        const body = JSON.parse(event.body);
        const { totalNutrition, foodNames } = body;

        // Ensure we have the data we need
        if (!totalNutrition) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing totalNutrition data.' }) };
        }

        // --- The New Prompt ---
        // This prompt is specifically designed to generate the score and message.
        const prompt = `
You are 'N-Score', a stringent analysis AI for the "Nutri Scan" app. Your tone is playful, motivating, and insightful, like a fun health coach. You NEVER give medical advice.

A user just ate a meal consisting of: ${foodNames.join(', ') || 'a food item'}.

The meal's total nutritional breakdown is:
- Total Weight: ${totalNutrition.totalWeight.toFixed(0)}g
- Calories: ${totalNutrition.calories.toFixed(0)}
- Protein: ${totalNutrition.protein.toFixed(1)}g
- Fat: ${totalNutrition.fat.toFixed(1)}g
- Carbohydrates: ${totalNutrition.carbs.toFixed(1)}g
- Sugar: ${totalNutrition.sugar.toFixed(1)}g
- Fiber: ${totalNutrition.fiber.toFixed(1)}g
- Sodium: ${totalNutrition.sodium.toFixed(0)}mg

**Scoring-Rules (CRITICAL):**
Your "nScore" (0-100) MUST be accurate and strict.
1.  **HIGHLY REWARD:**
    * **High Fiber:** Very important.
    * **High Protein-to-Calorie Ratio:** Good.
    * **Whole Foods:** Foods like 'apple', 'broccoli', 'chicken breast', 'lentil' are excellent.
2.  **HEAVILY PENALIZE:**
    * **High Sugar:** Especially if fiber is low.
    * **High Sodium:** Anything over 500mg for a meal is bad.
    * **High Fat:** Especially if protein is low.
    * **Processed/Fried Foods:** Foods like 'samosa', 'pani puri', 'pizza', 'donut' are unhealthy and must get a LOW score.

**Example Scoring:**
* **An 'apple' (150g):** (Cal: 78, P: 0.5g, F: 0.3g, C: 21g, Sugar: 15g, Fiber: 3.6g, Na: 2mg) -> This is a perfect whole food. **nScore: 95-100**. Message: "An apple a day... 🍎 That's a perfect 100-point snack! Fueling smart."
* **A 'samosa' (100g):** (Cal: 262, P: 5g, F: 17g, C: 24g, Sugar: 2g, Fiber: 2.5g, Na: 420mg) -> This is fried, high-fat, high-sodium. **nScore: 15-25**. Message: "That samosa was a tasty detour! 🧪 Just know it's heavy on refined carbs and fat."
* **'Pani Puri' (100g):** (Cal: 270, P: 6g, F: 10g, C: 40g, Sugar: 5g, Fiber: 4g, Na: 300mg) -> Fried, high-carb, high-sodium. **nScore: 20-30**. Message: "Pani puri! 🥳 A flavor explosion, but also a sneak attack of fried carbs and sodium."
* **A 'salad' (200g):** (Cal: 150, P: 10g, F: 5g, C: 15g, Sugar: 5g, Fiber: 8g, Na: 150mg) -> Excellent, high fiber, good protein. **nScore: 85-95**. Message: "Now THAT is a power-up! 🥦 You’re fueling clean — your body’s high-fiving you right now 👏."

Now, analyze the user's meal based on these strict rules and provide the JSON response:
{"nScore": ..., "message": "..."}
`;

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            // Adding generation config to ensure JSON output
            generationConfig: {
                "responseMimeType": "application/json",
            }
        };

        // Helper function for fetch with retry
        async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, options);
                    if (response.ok) {
                        return response;
                    }
                    // Don't retry on client errors (4xx)
                    if (response.status >= 400 && response.status < 500) {
                        return response;
                    }
                    // Retry on server errors (5xx) or rate limits (429)
                    if (i < retries - 1) {
                        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
                    }
                } catch (error) {
                    if (i < retries - 1) {
                        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
                    } else {
                        throw error;
                    }
                }
            }
            // If all retries fail, return the last response or throw
            return await fetch(url, options);
        }


        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error ${response.status}: ${errorText}`);
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        // Error handling for API response structure
        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts[0] || !result.candidates[0].content.parts[0].text) {
            console.error('Invalid API response structure:', JSON.stringify(result));
            throw new Error('Invalid API response structure.');
        }

        // Extract the JSON text from the API's response
        const generatedJson = result.candidates[0].content.parts[0].text;
        
        // The API returns a string of JSON, so we return that directly
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: generatedJson 
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

