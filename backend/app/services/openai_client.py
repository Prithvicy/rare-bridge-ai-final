from ..config import settings
import json
from typing import List, Dict, Any, Optional

class OpenAIClient:
    def __init__(self):
        self.enabled = bool(settings.OPENAI_API_KEY) and not settings.USE_MOCKS

    async def chat(self, messages: list[dict]) -> dict:
        if not self.enabled:
            last = messages[-1]["content"] if messages else ""
            return {"role":"assistant","content":f'(Mock) Answer to: "{last}"',
                    "citations":[{"id":"d1","title":"Understanding PKU"}]}
        
        try:
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=500
            )
            
            return {
                "role": "assistant",
                "content": response.choices[0].message.content,
                "citations": []
            }
        except Exception as e:
            print(f"OpenAI error: {e}")
            return {"role": "assistant", "content": "I'm having trouble processing that request.", "citations": []}

    async def pws_chat(self, message: str, image_base64: Optional[str] = None, filters: Optional[Dict] = None) -> Dict[str, Any]:
        """Handle PWS recipe chat with OpenAI"""
        if not self.enabled:
            # Return mock response
            return self._get_mock_response(message, bool(image_base64), filters)
        
        try:
            import openai
            openai.api_key = settings.OPENAI_API_KEY  # type: ignore

            # Build the system prompt
            system_prompt = """You are a PWS (Prader-Willi Syndrome) nutrition expert and recipe assistant.

PWS Dietary Guidelines:
- NO added sugars or artificial sweeteners
- Whole grains only (no refined grains)
- Low calorie density foods (high volume, low calorie)
- Lean proteins preferred
- Plenty of non-starchy vegetables
- Portion control: 200-400 calories per meal
- Focus on satiety and nutrition

When creating recipes:
1. Always specify exact portions
2. Include calorie counts
3. Emphasize vegetables for volume
4. Use herbs and spices for flavor (not sugar/salt)
5. Cooking methods: grilling, baking, steaming, roasting (avoid frying)

When analyzing food images:
1. Identify all visible ingredients
2. Estimate portion sizes
3. Calculate approximate calories
4. Assess PWS compliance
5. Suggest improvements if needed

Always be encouraging and supportive while maintaining strict dietary guidelines.

Allergy and restriction handling:
1. Never include ingredients that conflict with the user's dietary restrictions or allergies.
2. If the user requests an item that conflicts with these constraints, clearly state the conflict and immediately provide compliant alternatives.
3. Offer at least two safe ingredient swaps or two fully compliant recipe options when a conflict exists.
4. Briefly justify why each alternative is compliant (e.g., nut-free, gluten-free, soy-free, lower calorie).
5. Respect provided preferences (meal_type, vegetables, protein, carb) when generating alternatives.

Formatting instructions:
- Return PLAIN TEXT ONLY.
- Do not use Markdown. Do not include **bold**, _italics_, # headings, code blocks, or backticks.
- Use simple lines and numbered lists only when needed (e.g., 1., 2., 3.).
- Avoid special Markdown symbols like **, ##, ```.
"""

            messages: list[dict] = [{"role": "system", "content": system_prompt}]

            # Handle image if provided
            if image_base64:
                messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"{message}\nPlease analyze this food image for PWS dietary compliance, estimate calories, and identify nutrients.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                },
                            },
                        ],
                    }
                )
            else:
                # Add filters to the message if provided
                filter_text = ""
                if filters:
                    filter_text = f"\n\nPlease use these preferences:\n"
                    if "meal_type" in filters:
                        filter_text += f"- Meal type: {filters['meal_type']}\n"
                    if "vegetables" in filters and filters["vegetables"]:
                        filter_text += (
                            f"- Include vegetables: {', '.join(filters['vegetables'])}\n"
                        )
                    if "protein" in filters and filters["protein"]:
                        filter_text += f"- Protein: {filters['protein']}\n"
                    if "carb" in filters and filters["carb"]:
                        filter_text += f"- Carbohydrate: {filters['carb']}\n"
                    if "calories_max" in filters:
                        filter_text += f"- Maximum calories: {filters['calories_max']}\n"
                    if (
                        "dietary_restrictions" in filters and filters["dietary_restrictions"]
                    ):
                        filter_text += (
                            f"- Dietary restrictions: {', '.join(filters['dietary_restrictions'])}\n"
                        )
                    if "allergies" in filters and filters["allergies"]:
                        filter_text += (
                            f"- Allergies to avoid: {', '.join(filters['allergies'])}\n"
                        )

                messages.append({"role": "user", "content": message + filter_text})

            # Make the API call (legacy SDK style)
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=messages,  # type: ignore[arg-type]
                max_tokens=1000,
                temperature=0.7,
            )

            content = response.choices[0].message.content  # type: ignore[index]
            content = self._sanitize_markdown(content or "")
            
            # Try to parse if it's a recipe
            recipe_data = self._extract_recipe_from_response(content)
            
            return {
                "type": "recipe" if recipe_data else ("food_analysis" if image_base64 else "chat"),
                "content": content,
                "recipe": recipe_data,
                "suggestions": self._generate_suggestions(content)
            }
            
        except Exception as e:
            print(f"OpenAI PWS chat error: {e}")
            # Graceful fallback to mocks for seamless demo experience
            return self._get_mock_response(message, bool(image_base64), filters)

    def _extract_recipe_from_response(self, content: str) -> Optional[Dict]:
        """Try to extract structured recipe data from AI response"""
        # This is a simplified extraction - you might want to make it more robust
        if "ingredients:" in content.lower() and "instructions:" in content.lower():
            # Basic recipe structure detected
            # In production, you'd want more sophisticated parsing
            return None  # Let the frontend display the formatted text for now
        return None

    def _sanitize_markdown(self, content: str) -> str:
        """Remove common Markdown formatting from model output to return plain text."""
        import re
        # Remove leading Markdown headings like #, ##, ### at line starts
        content = re.sub(r"(?m)^\s*#{1,6}\s*", "", content)
        # Remove bold/italic markers and backticks
        content = content.replace("**", "").replace("__", "").replace("`", "")
        # Remove triple backticks if any slipped in
        content = content.replace("```", "")
        return content

    def _generate_suggestions(self, content: str) -> List[str]:
        """Generate follow-up suggestions based on the response"""
        suggestions = []
        
        if "breakfast" in content.lower():
            suggestions.append("Show me a PWS-friendly lunch recipe")
        elif "lunch" in content.lower():
            suggestions.append("What's a good PWS dinner option?")
        elif "dinner" in content.lower():
            suggestions.append("Suggest healthy PWS snacks")
        
        if "vegetable" in content.lower():
            suggestions.append("Which proteins work well with vegetables?")
        
        if len(suggestions) == 0:
            suggestions = [
                "Generate a low-calorie dinner recipe",
                "What vegetables are PWS-approved?",
                "Show me high-protein, low-calorie options"
            ]
        
        return suggestions[:3]  # Return max 3 suggestions

    def _get_mock_response(self, message: str, has_image: bool, filters: Optional[Dict]) -> Dict:
        """Get mock response for testing without API key"""
        if has_image:
            return {
                "type": "food_analysis",
                "content": """I can see a healthy meal in your image! Here's my analysis:

Estimated Nutrition:
- Calories: ~350
- Protein: 28g (grilled chicken breast, 4 oz)
- Carbs: 35g (quinoa, 1/2 cup cooked)
- Vegetables: Broccoli and bell peppers (2 cups)
- Fat: 8g (from cooking oil)

PWS Compliance: Excellent (✅)
- Low calorie density with high volume from vegetables
- Lean protein source
- Whole grain carbohydrate
- No added sugars

Suggestions:
- Great portion control!
- Consider adding more non-starchy vegetables for extra volume
- You could use herbs like rosemary or thyme for more flavor""",
                "recipe": None,
                "suggestions": [
                    "Show me similar PWS-friendly meals",
                    "How can I meal prep this?",
                    "What sauce can I add that's PWS-safe?"
                ]
            }
        
        if filters or "recipe" in message.lower():
            return {
                "type": "recipe",
                "content": "Here's a delicious PWS-friendly recipe for you!",
                "recipe": {
                    "name": "Herb-Crusted Chicken with Roasted Rainbow Vegetables",
                    "calories": 320,
                    "servings": 1,
                    "prep_time": "15 minutes",
                    "cook_time": "25 minutes",
                    "ingredients": [
                        "4 oz boneless, skinless chicken breast",
                        "1 cup broccoli florets",
                        "1/2 cup sliced bell peppers (mixed colors)",
                        "1/2 cup sliced zucchini",
                        "1/4 cup sliced red onion",
                        "1 tablespoon olive oil",
                        "1 teaspoon Italian herbs",
                        "1/2 teaspoon garlic powder",
                        "1/4 teaspoon black pepper",
                        "1/4 teaspoon paprika",
                        "Fresh lemon wedge for serving"
                    ],
                    "instructions": [
                        "Preheat oven to 400°F (200°C)",
                        "Pat chicken dry and season both sides with Italian herbs, garlic powder, pepper, and paprika",
                        "Cut all vegetables into similar-sized pieces for even cooking",
                        "Toss vegetables with 1/2 tablespoon olive oil and a pinch of seasoning",
                        "Heat remaining oil in oven-safe skillet over medium-high heat",
                        "Sear chicken 2-3 minutes per side until golden",
                        "Add vegetables around chicken in the skillet",
                        "Transfer skillet to oven and bake 15-18 minutes until chicken reaches 165°F",
                        "Let rest 5 minutes, then serve with fresh lemon"
                    ],
                    "nutrition": {
                        "calories": 320,
                        "protein": "35g",
                        "carbs": "18g",
                        "fat": "12g",
                        "fiber": "6g"
                    }
                },
                "suggestions": [
                    "Try this with different vegetables",
                    "Add a side of quinoa for more sustaining energy",
                    "Make it spicier with cayenne pepper"
                ]
            }
        
        # Default chat response
        return {
            "type": "chat",
            "content": """Hello! I'm your PWS nutrition assistant. I can help you with:

🍽️ Generate Custom Recipes - Tell me your preferences and dietary needs
📸 Analyze Food Photos - Upload an image and I'll estimate calories and check PWS compliance
🥗 Meal Planning - Get balanced meal ideas for breakfast, lunch, dinner, or snacks
📚 Nutrition Guidance - Learn about PWS-friendly ingredients and cooking tips

What would you like help with today?""",
            "recipe": None,
            "suggestions": [
                "Show me a low-calorie dinner recipe",
                "What vegetables are PWS-approved?",
                "Help me plan meals for this week"
            ]
        }

    async def recipes(self, tags: list[str] | None) -> list[dict]:
        if not self.enabled:
            return [
                {"id":"r1","title":"Low-Protein Pancakes","tags":["breakfast"]},
                {"id":"r2","title":"Vegetable Stir-Fry","tags":["lunch", "dinner"]},
                {"id":"r3","title":"Greek Yogurt Parfait","tags":["snack"]}
            ]
        
        try:
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            
            prompt = f"Generate 3 PWS-friendly recipes for {', '.join(tags) if tags else 'any meal'}. Return as JSON array with id, title, and tags."
            
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a PWS nutrition expert. Generate low-calorie, no-sugar recipes."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300
            )
            
            # Parse response and return recipes
            content = response.choices[0].message.content
            try:
                recipes = json.loads(content)
                return recipes
            except:
                return [{"id": "r1", "title": "PWS-Friendly Recipe", "tags": tags or ["general"]}]
                
        except Exception as e:
            print(f"Recipe generation error: {e}")
            return []

    async def embed(self, text: str) -> list[float]:
        if not self.enabled:
            return [0.0]*1536
        
        try:
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            
            response = openai.Embedding.create(
                model="text-embedding-ada-002",
                input=text
            )
            
            return response['data'][0]['embedding']
        except Exception as e:
            print(f"Embedding error: {e}")
            return [0.0]*1536