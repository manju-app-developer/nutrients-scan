// /netlify/functions/get-n-score.js
// This function receives aggregated nutritional data from the client
// and asks the AI to generate an N-Score and a fun, insightful message.

exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    // Note: Using a specific model like 'gemini-1.5-flash-latest' is recommended.
    // Update the model name as new ones become available.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
You are 'N-Score', the analysis AI for the "Nutri Scan" app. Your tone is playful, motivating, and insightful, like a fun health coach. You NEVER give medical advice.

A user just ate a meal consisting of: ${foodNames.join(', ') || 'a food item'}.

The meal's total nutritional breakdown is:
- Calories: ${totalNutrition.calories.toFixed(0)}
- Protein: ${totalNutrition.protein.toFixed(1)}g
- Fat: ${totalNutrition.fat.toFixed(1)}g
- Carbohydrates: ${totalNutrition.carbs.toFixed(1)}g
- Sugar: ${totalNutrition.sugar.toFixed(1)}g
- Fiber: ${totalNutrition.fiber.toFixed(1)}g
- Sodium: ${totalNutrition.sodium.toFixed(0)}mg

Based on this data, provide two things in a valid JSON object:
1.  "nScore": A holistic "N-Score" from 0 (least healthy) to 100 (most healthy). Base this on a good balance of macros (protein, fat, carbs), high fiber, and low sugar & sodium.
2.  "message": A short, fun, and insightful statement (1-2 sentences) about the meal, using one of these tones: Playful Awareness, Fun Comparison, Positive Reinforcement, Smart Suggestion, or Educational Insight.

Example 1 (Healthy):
{"nScore": 92, "message": "Broccoli wins again! 🥦 You’re fueling clean — your body’s high-fiving you right now 👏."}

Example 2 (Unhealthy):
{"nScore": 28, "message": "This snack is ultra-processed 🧪 and packed with quick carbs ⚡ — good for taste buds, not your goals!"}

Example 3 (Mixed):
{"nScore": 65, "message": "This meal's score dropped because it's high in sodium. A little less sauce next time = a higher N-Score! 📈"}

Example 4 (Sugary):
{"nScore": 40, "message": "You just had 3 cookies’ worth of sugar 🍪… disguised as a ‘healthy bar’ 🤭."}

Now, analyze the user's meal and provide the JSON response.
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

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();

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
