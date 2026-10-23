export class GroceryItems {
  // Using direct image URLs that actually represent the correct items
  static items = {
    // Fruits
    Apple: "assets/images/apple.png",
    Banana: "assets/images/banana.png",
    Orange: "https://images.unsplash.com/photo-1580052614034-c55d20bfee3b?w=400&h=400&fit=crop",
    Mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=400&fit=crop",
    Grapes: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400&h=400&fit=crop",
    Strawberry: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&h=400&fit=crop",
    Pineapple: "https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=400&h=400&fit=crop",
    Watermelon: "https://images.unsplash.com/photo-1563114773-84221bd62daa?w=400&h=400&fit=crop",
    Pomegranate: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=400&fit=crop",
    Kiwi: "https://images.unsplash.com/photo-1585059895524-72359e06133a?w=400&h=400&fit=crop",

    // Vegetables
    Tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=400&fit=crop",
    Potato: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop",
    Onion: "https://images.unsplash.com/photo-1508747703725-719777637510?w=400&h=400&fit=crop",
    Carrot: "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=400&h=400&fit=crop",
    Broccoli: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400&h=400&fit=crop",
    Spinach: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop",
    Cabbage: "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&h=400&fit=crop",
    Cauliflower: "https://images.unsplash.com/photo-1510627489930-0c1b0bfb6785?w=400&h=400&fit=crop",
    "Bell Pepper": "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=400&h=400&fit=crop",
    Cucumber: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400&h=400&fit=crop",
    Lettuce: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=400&fit=crop",
    Beetroot: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=400&fit=crop",

    // Pulses & Legumes
    Lentils: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop",
    Chickpeas: "https://images.unsplash.com/photo-1610648659005-89bbc2020b80?w=400&h=400&fit=crop",
    "Black Beans": "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&h=400&fit=crop",
    "Kidney Beans": "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&h=400&fit=crop",

    // Beverages
    Tea: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop",
    Coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
    "Fruit Juice": "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400&h=400&fit=crop",
    "Dried Fruit": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop",

    // Condiments & Sauces
    "Tomato Sauce": "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=400&fit=crop",
    Salt: "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=400&h=400&fit=crop",
    Sugar: "https://images.unsplash.com/photo-1582049165715-8796f82d5c71?w=400&h=400&fit=crop",
    Honey: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=400&fit=crop",

    // Seafood & Meat
    Fish: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400&h=400&fit=crop",
    Chicken: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop",
    Eggs: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&h=400&fit=crop",

    // Bakery Items
    Bread: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop",
    Cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
  }

  static getAllItems() {
    return Object.keys(this.items).sort()
  }

  static getImageUrl(itemName) {
    return this.items[itemName]
  }

  static getItemsByCategory(category) {
    switch (category.toLowerCase()) {
      case "fruits":
        return Object.keys(this.items).filter((item) =>
          [
            "Apple",
            "Banana",
            "Orange",
            "Mango",
            "Grapes",
            "Strawberry",
            "Pineapple",
            "Watermelon",
            "Pomegranate",
            "Kiwi",
          ].includes(item),
        )
      case "vegetables":
        return Object.keys(this.items).filter((item) =>
          [
            "Tomato",
            "Potato",
            "Onion",
            "Carrot",
            "Broccoli",
            "Spinach",
            "Cabbage",
            "Cauliflower",
            "Bell Pepper",
            "Cucumber",
            "Lettuce",
            "Beetroot",
          ].includes(item),
        )
      case "pulses & legumes":
        return Object.keys(this.items).filter((item) =>
          ["Lentils", "Chickpeas", "Black Beans", "Kidney Beans"].includes(item),
        )
      case "beverages":
        return Object.keys(this.items).filter((item) => ["Tea", "Coffee", "Fruit Juice"].includes(item))
      case "condiments & sauces":
        return Object.keys(this.items).filter((item) => ["Tomato Sauce", "Salt", "Sugar", "Honey"].includes(item))
      case "seafood & meat":
        return Object.keys(this.items).filter((item) => ["Fish", "Chicken", "Eggs"].includes(item))
      case "bakery":
        return Object.keys(this.items).filter((item) => ["Bread", "Cake"].includes(item))
      default:
        return this.getAllItems()
    }
  }
}
