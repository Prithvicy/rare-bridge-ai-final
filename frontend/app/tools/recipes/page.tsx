"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api } from "@/lib/api";
import { useState, useRef } from "react";
import {
  Send,
  Upload,
  ChefHat,
  Apple,
  Filter,
  Camera,
  Clock,
  Flame,
  X,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  image?: string;
  recipe?: Recipe;
  suggestions?: string[];
}

interface Recipe {
  name: string;
  calories: number;
  servings: number;
  prep_time: string;
  cook_time: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
  };
}

const PWS_INGREDIENTS = {
  vegetables: [
    "Carrots",
    "Cucumbers",
    "Green Beans",
    "Broccoli",
    "Cauliflower",
    "Spinach",
    "Lettuce",
    "Tomatoes",
    "Celery",
    "Zucchini",
    "Yellow Squash",
    "Asparagus",
    "Bell Peppers",
    "Onions",
    "Brussel Sprouts",
    "Artichoke",
    "Cabbage",
    "Kale",
    "Snap Peas",
    "Okra",
    "Collards",
    "Bok Choy",
    "Eggplant",
    "Spaghetti Squash",
    "Swiss Chard",
    "Turnips",
    "Amaranth",
  ],
  proteins: [
    "Beef",
    "Pork",
    "Chicken",
    "Turkey",
    "Salmon",
    "Tuna",
    "White Fish",
    "Shrimp",
    "Crab",
    "Lobster",
    "Scallops",
    "Clams",
    "Eggs",
    "Greek Yogurt",
    "Nuts",
    "Seeds",
    "Cottage Cheese",
    "Duck",
    "Soy/Tofu/Tempeh",
    "Lamb/Goat",
  ],
  carbs: [
    "Whole Grain Bread",
    "Whole Grain Pasta",
    "Quinoa",
    "Brown rice",
    "Wild rice",
    "Barley",
    "Oatmeal",
    "Black beans",
    "Kidney beans",
    "Pinto beans",
    "White beans",
    "Lima beans",
    "Chickpeas",
    "Hummus",
    "Black eyed peas",
    "Edamame",
    "Lentils",
    "Whole grain couscous",
    "Farro",
    "Millet",
    "Pumpkin",
    "Popcorn",
    "Buckwheat",
    "Butternut squash",
    "Acorn squash",
    "Green peas",
    "Sweet potato",
  ],
};

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
];
const COMMON_ALLERGIES = [
  "Nuts",
  "Dairy",
  "Eggs",
  "Soy",
  "Shellfish",
  "Fish",
  "Gluten",
];

export default function PWSRecipes() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content:
        "Hello! I'm your PWS nutrition assistant. I can help you with:\n\n🍽️ Generate PWS-friendly recipes\n📸 Analyze food photos for calories & nutrition\n🥗 Suggest meals with approved ingredients\n💡 Provide dietary guidance\n\nHow can I help you today?",
      suggestions: [
        "Generate a low-calorie dinner recipe",
        "What vegetables are PWS-approved?",
        "Create a meal plan for today",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [mealType, setMealType] = useState("Dinner");
  const [selectedVegetables, setSelectedVegetables] = useState<string[]>([]);
  const [selectedProtein, setSelectedProtein] = useState("");
  const [selectedCarb, setSelectedCarb] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [maxCalories, setMaxCalories] = useState(400);

  // Expanded sections for ingredients
  const [expandedSections, setExpandedSections] = useState({
    vegetables: false,
    proteins: false,
    carbs: false,
  });

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSelectedImage(base64);
        toast.success(
          "Image uploaded! Add a message or send as is for analysis."
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text || "Analyze this image",
      image: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Prepare the request body
      const body: any = {
        message: text || "Analyze this image for PWS dietary compliance",
      };

      if (selectedImage) {
        // Extract base64 data (remove data:image/...;base64, prefix)
        body.image = selectedImage.split(",")[1];
      }

      if (showFilters) {
        body.filters = {
          meal_type: mealType.toLowerCase(),
          vegetables:
            selectedVegetables.length > 0 ? selectedVegetables : undefined,
          protein: selectedProtein || undefined,
          carb: selectedCarb || undefined,
          dietary_restrictions:
            dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
          allergies: allergies.length > 0 ? allergies : undefined,
          calories_max: maxCalories,
        };
        // Remove undefined values
        Object.keys(body.filters).forEach((key) => {
          if (body.filters[key] === undefined) delete body.filters[key];
        });
      }

      const data = await api.pwsRecipes.chat(body);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: data.content,
        recipe: data.recipe,
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSelectedImage(null);
      setShowFilters(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    sendMessage(action);
  };

  const toggleVegetable = (veg: string) => {
    setSelectedVegetables((prev) =>
      prev.includes(veg) ? prev.filter((v) => v !== veg) : [...prev, veg]
    );
  };

  const toggleRestriction = (restriction: string) => {
    setDietaryRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction]
    );
  };

  const toggleAllergy = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy]
    );
  };

  const applyFilters = () => {
    const filterSummary = `Generate a ${mealType.toLowerCase()} recipe${
      selectedVegetables.length > 0
        ? ` with ${selectedVegetables.join(", ")}`
        : ""
    }${selectedProtein ? ` and ${selectedProtein}` : ""}${
      selectedCarb ? ` including ${selectedCarb}` : ""
    }. Max ${maxCalories} calories.${
      dietaryRestrictions.length > 0
        ? ` Dietary restrictions: ${dietaryRestrictions.join(", ")}.`
        : ""
    }${allergies.length > 0 ? ` Allergies: ${allergies.join(", ")}.` : ""}`;

    sendMessage(filterSummary);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl text-white">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">PWS Recipe Assistant</h1>
            <p className="text-gray-600">
              Nutrition guidance & meal planning for Prader-Willi Syndrome
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">
                PWS Dietary Guidelines
              </p>
              <p className="text-blue-700">
                All recipes follow PWS guidelines: No added sugars, whole grains
                only, lean proteins, plenty of vegetables, and
                portion-controlled calories (200-400 per serving).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border shadow-sm">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] ${
                      message.type === "user"
                        ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl rounded-tr-sm"
                        : "bg-gray-100 rounded-2xl rounded-tl-sm"
                    } p-4`}
                  >
                    {message.image && (
                      <img
                        src={message.image}
                        alt="Uploaded food"
                        className="mb-3 rounded-lg max-h-48 object-cover"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Recipe Card */}
                    {message.recipe && (
                      <div className="mt-4 bg-white rounded-xl p-4 text-gray-900">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-yellow-500" />
                          {message.recipe.name}
                        </h3>

                        <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span>{message.recipe.calories} cal</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span>{message.recipe.prep_time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ChefHat className="w-4 h-4 text-green-500" />
                            <span>{message.recipe.servings} serving</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm mb-1">
                              Ingredients:
                            </h4>
                            <ul className="text-sm space-y-1">
                              {message.recipe.ingredients.map((ing, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">
                                    •
                                  </span>
                                  <span>{ing}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm mb-1">
                              Instructions:
                            </h4>
                            <ol className="text-sm space-y-1">
                              {message.recipe.instructions.map((step, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="font-medium text-brand-600">
                                    {i + 1}.
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {message.recipe.nutrition && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <h4 className="font-semibold text-sm mb-2">
                                Nutrition Facts:
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  Calories: {message.recipe.nutrition.calories}
                                </div>
                                <div>
                                  Protein: {message.recipe.nutrition.protein}
                                </div>
                                <div>
                                  Carbs: {message.recipe.nutrition.carbs}
                                </div>
                                <div>Fat: {message.recipe.nutrition.fat}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium">Try asking:</p>
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(suggestion)}
                            className="block w-full text-left text-sm p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              {/* Selected Image Preview */}
              {selectedImage && (
                <div className="mb-3 relative inline-block">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="h-20 rounded-lg border"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  title="Upload food image"
                >
                  <Camera className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-xl transition-colors ${
                    showFilters
                      ? "bg-brand-100 text-brand-700"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  title="Recipe filters"
                >
                  <Filter className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
                  placeholder="Ask about recipes, ingredients, or upload a food photo..."
                  className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || (!input.trim() && !selectedImage)}
                  className="px-4 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Filters & Quick Actions */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() =>
                  handleQuickAction("Generate a low-calorie breakfast recipe")
                }
                className="w-full text-left p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl hover:from-orange-100 hover:to-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌅</span>
                  <div>
                    <p className="font-medium text-sm">Breakfast Recipe</p>
                    <p className="text-xs text-gray-600">200-300 calories</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickAction(
                    "Create a filling lunch with chicken and vegetables"
                  )
                }
                className="w-full text-left p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥗</span>
                  <div>
                    <p className="font-medium text-sm">Lunch Ideas</p>
                    <p className="text-xs text-gray-600">
                      High volume, low calorie
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickAction(
                    "Suggest a PWS-friendly dinner under 400 calories"
                  )
                }
                className="w-full text-left p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🍽️</span>
                  <div>
                    <p className="font-medium text-sm">Dinner Recipe</p>
                    <p className="text-xs text-gray-600">
                      Satisfying & nutritious
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() =>
                  handleQuickAction("What are healthy PWS-approved snacks?")
                }
                className="w-full text-left p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🍎</span>
                  <div>
                    <p className="font-medium text-sm">Healthy Snacks</p>
                    <p className="text-xs text-gray-600">Under 150 calories</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-2xl border p-4 animate-in fade-in slide-in-from-right duration-300">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-brand-600" />
                Recipe Filters
              </h3>

              <div className="space-y-4">
                {/* Meal Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Meal Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setMealType(type)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mealType === type
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vegetables */}
                <div>
                  <button
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        vegetables: !prev.vegetables,
                      }))
                    }
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
                  >
                    <span>
                      Vegetables ({selectedVegetables.length} selected)
                    </span>
                    {expandedSections.vegetables ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {expandedSections.vegetables && (
                    <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded-lg">
                      {PWS_INGREDIENTS.vegetables.map((veg) => (
                        <label
                          key={veg}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVegetables.includes(veg)}
                            onChange={() => toggleVegetable(veg)}
                            className="rounded text-brand-600"
                          />
                          <span className="text-sm">{veg}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Protein */}
                <div>
                  <button
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        proteins: !prev.proteins,
                      }))
                    }
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
                  >
                    <span>
                      Protein {selectedProtein && `(${selectedProtein})`}
                    </span>
                    {expandedSections.proteins ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {expandedSections.proteins && (
                    <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded-lg">
                      {PWS_INGREDIENTS.proteins.map((protein) => (
                        <label
                          key={protein}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                        >
                          <input
                            type="radio"
                            name="protein"
                            checked={selectedProtein === protein}
                            onChange={() => setSelectedProtein(protein)}
                            className="text-brand-600"
                          />
                          <span className="text-sm">{protein}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Carbs */}
                <div>
                  <button
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        carbs: !prev.carbs,
                      }))
                    }
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
                  >
                    <span>Carbs {selectedCarb && `(${selectedCarb})`}</span>
                    {expandedSections.carbs ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {expandedSections.carbs && (
                    <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded-lg">
                      {PWS_INGREDIENTS.carbs.map((carb) => (
                        <label
                          key={carb}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                        >
                          <input
                            type="radio"
                            name="carb"
                            checked={selectedCarb === carb}
                            onChange={() => setSelectedCarb(carb)}
                            className="text-brand-600"
                          />
                          <span className="text-sm">{carb}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Max Calories */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Max Calories: {maxCalories}
                  </label>
                  <input
                    type="range"
                    min="200"
                    max="500"
                    step="50"
                    value={maxCalories}
                    onChange={(e) => setMaxCalories(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>200</span>
                    <span>500</span>
                  </div>
                </div>

                {/* Dietary Restrictions */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Dietary Restrictions
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_RESTRICTIONS.map((restriction) => (
                      <button
                        key={restriction}
                        onClick={() => toggleRestriction(restriction)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          dietaryRestrictions.includes(restriction)
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {restriction}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Allergies
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGIES.map((allergy) => (
                      <button
                        key={allergy}
                        onClick={() => toggleAllergy(allergy)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          allergies.includes(allergy)
                            ? "bg-red-600 text-white"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {allergy}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Apply Filters Button */}
                <button
                  onClick={applyFilters}
                  className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Generate Recipe
                </button>

                {/* Clear Filters */}
                <button
                  onClick={() => {
                    setMealType("Dinner");
                    setSelectedVegetables([]);
                    setSelectedProtein("");
                    setSelectedCarb("");
                    setDietaryRestrictions([]);
                    setAllergies([]);
                    setMaxCalories(400);
                  }}
                  className="w-full py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          {/* PWS Guidelines Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-900">
              <Apple className="w-5 h-5 text-emerald-600" />
              PWS Guidelines
            </h3>
            <ul className="space-y-2 text-sm text-emerald-800">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>No added sugars or sweeteners</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Whole grains only</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>High volume, low calorie foods</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Lean proteins & plenty of vegetables</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>200-400 calories per meal</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
