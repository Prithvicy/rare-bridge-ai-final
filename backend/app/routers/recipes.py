from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Optional, List
import base64
import json
from ..schemas import (
    RecipesRequest,
    RecipesResponse,
    Recipe,
    PWSChatRequest,
    GenerateRecipeRequest,
    RecipeFeedbackRequest,
    RecipeEmailRequest,
)
from ..config import settings
import httpx
from ..services.openai_client import OpenAIClient

router = APIRouter()

# PWS-approved ingredients database
PWS_INGREDIENTS = {
    "vegetables": [
        "Carrots", "Cucumbers", "Green Beans", "Broccoli", "Cauliflower", "Spinach", 
        "Lettuce", "Tomatoes", "Celery", "Zucchini", "Yellow Squash", "Asparagus", 
        "Bell Peppers", "Onions", "Brussel Sprouts", "Artichoke", "Cabbage", "Kale", 
        "Snap Peas", "Okra", "Collards", "Bok Choy", "Eggplant", "Spaghetti Squash", 
        "Swiss Chard", "Turnips", "Amaranth"
    ],
    "proteins": [
        "Beef", "Pork", "Chicken", "Turkey", "Salmon", "Tuna", "White Fish", "Shrimp", 
        "Crab", "Lobster", "Scallops", "Clams", "Eggs", "Greek Yogurt", "Nuts", "Seeds", 
        "Cottage Cheese", "Duck", "Soy/Tofu/Tempeh", "Lamb/Goat"
    ],
    "carbs": [
        "Whole Grain Bread", "Whole Grain Pasta", "Quinoa", "Brown rice", "Wild rice", 
        "Barley", "Oatmeal", "Black beans", "Kidney beans", "Pinto beans", "White beans", 
        "Lima beans", "Chickpeas", "Hummus", "Black eyed peas", "Edamame", "Lentils", 
        "Whole grain couscous", "Farro", "Millet", "Pumpkin", "Popcorn", "Buckwheat", 
        "Butternut squash", "Acorn squash", "Green peas", "Sweet potato"
    ]
}

@router.post("/chat")
async def pws_chat(req: PWSChatRequest):
    """PWS Recipe Chat - handles text, image analysis, and recipe recommendations.
    Accepts JSON body with message, optional base64 image, and optional filters.
    """
    try:
        client = OpenAIClient()
        filters_dict = (
            req.filters.model_dump(exclude_none=True) if req.filters else None
        )
        return await client.pws_chat(
            message=req.message,
            image_base64=req.image,
            filters=filters_dict,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-image")
async def analyze_food_image(file: UploadFile = File(...)):
    """Analyze a food image for PWS dietary compliance"""
    # Read and encode the image
    contents = await file.read()
    base64_image = base64.b64encode(contents).decode("utf-8")

    # Call the OpenAI client directly with the image
    try:
        client = OpenAIClient()
        result = await client.pws_chat(
            message="Analyze this food for PWS dietary compliance. Estimate calories and nutrients.",
            image_base64=base64_image,
            filters=None,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ingredients")
async def get_ingredients(category: Optional[str] = None):
    """Get PWS-approved ingredients by category"""
    if category and category in PWS_INGREDIENTS:
        return {"category": category, "items": PWS_INGREDIENTS[category]}
    return PWS_INGREDIENTS

@router.post("/generate-recipe")
async def generate_recipe(req: GenerateRecipeRequest):
    """Generate a PWS-friendly recipe based on filters. Accepts JSON body."""
    filters = {
        "meal_type": req.meal_type,
        "vegetables": req.vegetables,
        "protein": req.protein,
        "carb": req.carb,
        "dietary_restrictions": req.dietary_restrictions,
        "allergies": req.allergies,
        "calories_max": req.calories_max,
    }
    filters = {k: v for k, v in filters.items() if v is not None}

    message = f"Generate a PWS-friendly {req.meal_type} recipe"

    try:
        client = OpenAIClient()
        result = await client.pws_chat(message=message, image_base64=None, filters=filters)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Keep the original endpoint for backward compatibility
@router.post("", response_model=RecipesResponse)
async def recipes(req: RecipesRequest):
    """Original recipes endpoint - kept for backward compatibility"""
    if settings.USE_MOCKS or not settings.OPENAI_API_KEY:
        # Return mock recipes
        return RecipesResponse(items=[
            Recipe(id="r1", title="Low-Protein Pancakes", tags=["breakfast"]),
            Recipe(id="r2", title="Vegetable Stir-Fry", tags=["lunch", "dinner"]),
            Recipe(id="r3", title="Greek Yogurt Parfait", tags=["snack"])
        ])
    
    # Real implementation would call OpenAI here
    return RecipesResponse(items=[])

@router.post("/feedback")
async def recipe_feedback(req: RecipeFeedbackRequest):
    """Record like/dislike for a generated recipe suggestion.

    In mock mode, simply return ok: True. In real mode, this is where you'd
    persist to a database or analytics store.
    """
    try:
        # In a real implementation, write to DB or analytics
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/email")
async def email_recipe(req: RecipeEmailRequest):
    """Send a recipe or assistant message to the requested email.

    In mock/live without mail provider configured, we'll just return ok=True.
    Hook up an SMTP or transactional email provider here if desired.
    """
    try:
        # If RESEND_API_KEY is not configured, just succeed (mock-ish)
        if not settings.RESEND_API_KEY:
            return {"ok": True}

        # Send via Resend API
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [req.to_email],
                    "subject": req.subject,
                    "text": req.body,
                },
            )
            res.raise_for_status()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))