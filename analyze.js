exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    try {
        // The image data and prompt are sent from the browser
        const body = JSON.parse(event.body);
        const { base64ImageData, supportedFoods } = body;

        const prompt = `Analyze the image for edible food items. From this specific list ONLY: ${supportedFoods.join(', ')}, identify each food item visible. Ignore all non-food items, packaging, or medication. For each identified food, provide its name, estimated weight in grams, and a confidence score (0-1). Return a valid JSON array of objects: [{"foodName": "...", "estimatedWeight": ..., "confidenceScore": ...}]. If no listed foods are found, return an empty array []. If you see something that looks like medication, return [{"foodName": "medicine", "estimatedWeight": 0, "confidenceScore": 1}].`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64ImageData } }
                ]
            }]
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
        
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};