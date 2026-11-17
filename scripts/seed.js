import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not defined in .env")
  process.exit(1)
}

const client = new MongoClient(uri)

async function seed() {
  try {
    await client.connect()
    const db = client.db('fixmate-service')

    console.log("Connected to MongoDB for seeding FixMate...")

    const usersCol = db.collection('users')
    const servicesCol = db.collection('services')
    const bookingsCol = db.collection('bookings')
    const paymentsCol = db.collection('payments')

    // Clean existing seed data (or keep custom user accounts)
    await servicesCol.deleteMany({})
    await bookingsCol.deleteMany({})
    await paymentsCol.deleteMany({})

    // 1. Seed Users (Upsert test users)
    const seedUsers = [
      {
        name: "FixMate Administrator",
        email: "admin@fixmate.com",
        role: "admin",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        phone: "+8801811223344",
        area: "Gulshan-1, Dhaka",
        bio: "FixMate System Administrator & Operations Lead",
        createdAt: new Date("2026-01-01")
      },
      {
        name: "Rahim Master Tech",
        email: "technician@fixmate.com",
        role: "technician",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        phone: "+8801711998877",
        area: "Dhanmondi, Dhaka",
        bio: "Certified Apple & Android Master Technician. Over 10 years experience repairing micro-soldering, displays, and motherboards.",
        createdAt: new Date("2026-01-05")
      },
      {
        name: "Karim Appliance Care",
        email: "karim@fixmate.com",
        role: "technician",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        phone: "+8801911445566",
        area: "Mirpur-10, Dhaka",
        bio: "Specialist in Inverter AC servicing, Compressor repairs, and Washing machine PCB diagnostics.",
        createdAt: new Date("2026-01-08")
      },
      {
        name: "Tanvir Ahmed",
        email: "customer@fixmate.com",
        role: "customer",
        image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
        phone: "+8801611778899",
        area: "Banani, Dhaka",
        bio: "Tech enthusiast and smart home owner.",
        createdAt: new Date("2026-01-10")
      }
    ]

    for (const u of seedUsers) {
      await usersCol.updateOne(
        { email: u.email },
        { $set: u },
        { upsert: true }
      )
    }
    console.log("Seeded test users (Admin, Technician, Customer)")

    // 2. Seed Services (14 services across 7 categories)
    const seedServices = [
      // Smartphone
      {
        _id: new ObjectId(),
        title: "iPhone 14/15 Pro OLED Display Replacement",
        category: "Smartphone",
        description: "Original OEM Super Retina XDR OLED screen replacement. Includes TrueTone transfer, display adhesive water-resistance seal, and 6-month warranty on touch response.",
        image: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80",
        basePrice: 120,
        estimatedDuration: "1-2 hours",
        serviceMode: "Shop Drop-off",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-01")
      },
      {
        _id: new ObjectId(),
        title: "Samsung Galaxy Battery & Fast-Charging Port Fix",
        category: "Smartphone",
        description: "Official Samsung genuine battery replacement with charging IC diagnosis. Resolves fast draining, overheating, and intermittent USB-C charging issues.",
        image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
        basePrice: 45,
        estimatedDuration: "1 hour",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-02")
      },

      // Laptop & PC
      {
        _id: new ObjectId(),
        title: "MacBook Pro Liquid Damage & Logic Board Repair",
        category: "Laptop & PC",
        description: "Ultrasonic board cleaning, SMD component micro-soldering, short-circuit trace repair, and keyboard backlight replacement for M1/M2/M3 MacBooks.",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
        basePrice: 150,
        estimatedDuration: "1-2 days",
        serviceMode: "Shop Drop-off",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-03")
      },
      {
        _id: new ObjectId(),
        title: "Gaming Desktop Deep Dusting & Thermal Paste Repaste",
        category: "Laptop & PC",
        description: "Complete chassis disassembly, high-pressure blower de-dusting, Noctua NT-H2 thermal paste application on CPU & GPU, and custom fan curve tuning.",
        image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80",
        basePrice: 35,
        estimatedDuration: "2-3 hours",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-04")
      },

      // AC
      {
        _id: new ObjectId(),
        title: "Inverter AC Jet Pump Chemical Servicing & Jet Cleaning",
        category: "AC",
        description: "High-pressure jet wash of indoor cooling coil, blower wheel, drain pan, and outdoor condenser. Eliminates foul odor, mold, and restores 100% cooling efficiency.",
        image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
        basePrice: 50,
        estimatedDuration: "2 hours",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-05")
      },
      {
        _id: new ObjectId(),
        title: "Split AC Gas Leak Repair & R32/R410 Refrigerant Refill",
        category: "AC",
        description: "Nitrogen pressure testing, copper flare leak soldering, vacuum evacuation, and precision weight charge of original eco-friendly R32 or R410a refrigerant.",
        image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
        basePrice: 75,
        estimatedDuration: "3-4 hours",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-06")
      },

      // Refrigerator
      {
        _id: new ObjectId(),
        title: "Frost-Free Refrigerator Thermostat & PCB Circuit Repair",
        category: "Refrigerator",
        description: "Diagnostic check for uneven cooling, ice buildup, faulty defrost timer, and inverter controller relay faults with original manufacturer replacements.",
        image: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80",
        basePrice: 60,
        estimatedDuration: "2-3 hours",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-07")
      },
      {
        _id: new ObjectId(),
        title: "Deep Freezer Inverter Compressor Repair & Relocation",
        category: "Refrigerator",
        description: "Commercial and residential deep freezer compressor relay replacement, copper line brazing, filter drier change, and gas recharge with 1-year compressor warranty.",
        image: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80",
        basePrice: 110,
        estimatedDuration: "1 day",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-08")
      },

      // TV
      {
        _id: new ObjectId(),
        title: "4K Smart LED TV Screen Backlight Strip Replacement",
        category: "TV",
        description: "Solves black screen with sound, flickering picture, and dark spots. Complete set replacement with genuine aluminum-base LED backlight arrays.",
        image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80",
        basePrice: 70,
        estimatedDuration: "3-4 hours",
        serviceMode: "Shop Drop-off",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-09")
      },
      {
        _id: new ObjectId(),
        title: "Android TV Motherboard & Power Supply Board Fix",
        category: "TV",
        description: "Diagnosis for TV not turning on, red standby light blinking, HDMI port failure, and boot-looping logo issues. Component level PCB rework.",
        image: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=800&q=80",
        basePrice: 55,
        estimatedDuration: "1 day",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-10")
      },

      // Washing Machine
      {
        _id: new ObjectId(),
        title: "Front-Load Washing Machine Drum Bearing & Seal Overhaul",
        category: "Washing Machine",
        description: "Eliminates loud spinning noise, rumbling vibration, and bottom water leaks. High-grade SKF stainless steel bearings and heavy duty rubber seal replacement.",
        image: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80",
        basePrice: 85,
        estimatedDuration: "4-5 hours",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-11")
      },
      {
        _id: new ObjectId(),
        title: "Top-Load Washing Machine Drain Pump & Sensor Service",
        category: "Washing Machine",
        description: "Fixes OE error codes, water not draining, spin cycle stoppage, and lid-lock sensor malfunction. Full electronic test run included.",
        image: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80",
        basePrice: 40,
        estimatedDuration: "2 hours",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-12")
      },

      // Electrical
      {
        _id: new ObjectId(),
        title: "Residential Short Circuit Diagnosis & Safety Rewiring",
        category: "Electrical",
        description: "Megger insulation resistance test, thermal imaging of overloaded conduits, earth leakage breaker repair, and certified flame-retardant wiring installation.",
        image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
        basePrice: 65,
        estimatedDuration: "3-5 hours",
        serviceMode: "Home Visit",
        serviceArea: "Mirpur, Dhaka",
        technicianName: "Karim Appliance Care",
        technicianEmail: "karim@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-13")
      },
      {
        _id: new ObjectId(),
        title: "Main Distribution Board (DB) & Sub-Meter Installation",
        category: "Electrical",
        description: "Installation of Schneider MCBs, RCCB shock protector, changeover switch, and digital sub-meter for apartments and small commercial offices.",
        image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80",
        basePrice: 90,
        estimatedDuration: "4 hours",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "approved",
        isAvailable: true,
        createdAt: new Date("2026-02-14")
      },

      // One pending service for Admin moderation demo
      {
        _id: new ObjectId(),
        title: "Solar Inverter & Battery Bank Performance Tune-up",
        category: "Electrical",
        description: "Hybrid solar inverter firmware upgrade, battery terminal cleaning, specific gravity test, and MPPT charge controller tuning.",
        image: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
        basePrice: 80,
        estimatedDuration: "3 hours",
        serviceMode: "Home Visit",
        serviceArea: "Dhanmondi, Dhaka",
        technicianName: "Rahim Master Tech",
        technicianEmail: "technician@fixmate.com",
        approvalStatus: "pending",
        isAvailable: true,
        createdAt: new Date("2026-02-15")
      }
    ]

    await servicesCol.insertMany(seedServices)
    console.log(`Seeded ${seedServices.length} realistic services across 7 categories`)

    // 3. Seed Connected Bookings (Across different pipeline statuses)
    const booking1Id = new ObjectId()
    const booking2Id = new ObjectId()
    const booking3Id = new ObjectId()
    const booking4Id = new ObjectId()
    const booking5Id = new ObjectId()

    const seedBookings = [
      // Status: requested (for Accept / Reject / Cancel testing)
      {
        _id: booking1Id,
        serviceId: seedServices[0]._id.toString(),
        serviceTitle: seedServices[0].title,
        serviceImage: seedServices[0].image,
        category: seedServices[0].category,
        basePrice: seedServices[0].basePrice,
        technicianName: seedServices[0].technicianName,
        technicianEmail: seedServices[0].technicianEmail,
        customerName: "Tanvir Ahmed",
        customerEmail: "customer@fixmate.com",
        customerPhone: "+8801611778899",
        address: "House 24, Road 7, Banani, Dhaka",
        preferredDate: new Date("2026-11-20"),
        problemDescription: "My iPhone 14 Pro fell from a table. The glass is cracked on the upper right corner and touch is unresponsive in that area.",
        status: "requested",
        finalAmount: 120,
        paymentStatus: "unpaid",
        createdAt: new Date("2026-11-15T10:00:00Z"),
        updatedAt: new Date("2026-11-15T10:00:00Z"),
        statusHistory: [
          { status: "requested", changedAt: new Date("2026-11-15T10:00:00Z"), changedBy: "customer@fixmate.com" }
        ]
      },

      // Status: accepted (for Start Work testing)
      {
        _id: booking2Id,
        serviceId: seedServices[2]._id.toString(),
        serviceTitle: seedServices[2].title,
        serviceImage: seedServices[2].image,
        category: seedServices[2].category,
        basePrice: seedServices[2].basePrice,
        technicianName: seedServices[2].technicianName,
        technicianEmail: seedServices[2].technicianEmail,
        customerName: "Tanvir Ahmed",
        customerEmail: "customer@fixmate.com",
        customerPhone: "+8801611778899",
        address: "House 24, Road 7, Banani, Dhaka",
        preferredDate: new Date("2026-11-21"),
        problemDescription: "Accidentally spilled coffee on the keyboard of my M1 MacBook. It turned off immediately and won't turn on again.",
        status: "accepted",
        finalAmount: 150,
        paymentStatus: "unpaid",
        createdAt: new Date("2026-11-14T09:30:00Z"),
        updatedAt: new Date("2026-11-14T11:00:00Z"),
        statusHistory: [
          { status: "requested", changedAt: new Date("2026-11-14T09:30:00Z"), changedBy: "customer@fixmate.com" },
          { status: "accepted", changedAt: new Date("2026-11-14T11:00:00Z"), changedBy: "technician@fixmate.com" }
        ]
      },

      // Status: in-progress (for Mark Completed & Final Amount modal testing)
      {
        _id: booking3Id,
        serviceId: seedServices[4]._id.toString(),
        serviceTitle: seedServices[4].title,
        serviceImage: seedServices[4].image,
        category: seedServices[4].category,
        basePrice: seedServices[4].basePrice,
        technicianName: seedServices[4].technicianName,
        technicianEmail: seedServices[4].technicianEmail,
        customerName: "Tanvir Ahmed",
        customerEmail: "customer@fixmate.com",
        customerPhone: "+8801611778899",
        address: "House 24, Road 7, Banani, Dhaka",
        preferredDate: new Date("2026-11-19"),
        problemDescription: "Gree 1.5 ton Inverter AC is not cooling properly and blowing warm air with water dripping from the indoor unit.",
        status: "in-progress",
        finalAmount: 50,
        paymentStatus: "unpaid",
        createdAt: new Date("2026-11-13T14:00:00Z"),
        updatedAt: new Date("2026-11-14T10:00:00Z"),
        statusHistory: [
          { status: "requested", changedAt: new Date("2026-11-13T14:00:00Z"), changedBy: "customer@fixmate.com" },
          { status: "accepted", changedAt: new Date("2026-11-13T16:00:00Z"), changedBy: "karim@fixmate.com" },
          { status: "in-progress", changedAt: new Date("2026-11-14T10:00:00Z"), changedBy: "karim@fixmate.com" }
        ]
      },

      // Status: completed & unpaid (for Pay Now testing)
      {
        _id: booking4Id,
        serviceId: seedServices[6]._id.toString(),
        serviceTitle: seedServices[6].title,
        serviceImage: seedServices[6].image,
        category: seedServices[6].category,
        basePrice: seedServices[6].basePrice,
        technicianName: seedServices[6].technicianName,
        technicianEmail: seedServices[6].technicianEmail,
        customerName: "Tanvir Ahmed",
        customerEmail: "customer@fixmate.com",
        customerPhone: "+8801611778899",
        address: "House 24, Road 7, Banani, Dhaka",
        preferredDate: new Date("2026-11-16"),
        problemDescription: "Samsung double-door refrigerator was forming thick ice blocks in the freezer and not cooling the lower fresh food compartment.",
        status: "completed",
        finalAmount: 65,
        paymentStatus: "unpaid",
        createdAt: new Date("2026-11-12T11:00:00Z"),
        updatedAt: new Date("2026-11-16T15:30:00Z"),
        statusHistory: [
          { status: "requested", changedAt: new Date("2026-11-12T11:00:00Z"), changedBy: "customer@fixmate.com" },
          { status: "accepted", changedAt: new Date("2026-11-12T13:00:00Z"), changedBy: "karim@fixmate.com" },
          { status: "in-progress", changedAt: new Date("2026-11-16T10:00:00Z"), changedBy: "karim@fixmate.com" },
          { status: "completed", changedAt: new Date("2026-11-16T15:30:00Z"), changedBy: "karim@fixmate.com" }
        ]
      },

      // Status: completed & paid (with linked payment history)
      {
        _id: booking5Id,
        serviceId: seedServices[8]._id.toString(),
        serviceTitle: seedServices[8].title,
        serviceImage: seedServices[8].image,
        category: seedServices[8].category,
        basePrice: seedServices[8].basePrice,
        technicianName: seedServices[8].technicianName,
        technicianEmail: seedServices[8].technicianEmail,
        customerName: "Tanvir Ahmed",
        customerEmail: "customer@fixmate.com",
        customerPhone: "+8801611778899",
        address: "House 24, Road 7, Banani, Dhaka",
        preferredDate: new Date("2026-11-10"),
        problemDescription: "Sony Bravia 55 inch 4K LED TV screen went completely dark while watching Netflix, sound was still playing normally.",
        status: "completed",
        finalAmount: 70,
        paymentStatus: "paid",
        createdAt: new Date("2026-11-09T08:00:00Z"),
        updatedAt: new Date("2026-11-10T16:00:00Z"),
        statusHistory: [
          { status: "requested", changedAt: new Date("2026-11-09T08:00:00Z"), changedBy: "customer@fixmate.com" },
          { status: "accepted", changedAt: new Date("2026-11-09T10:00:00Z"), changedBy: "technician@fixmate.com" },
          { status: "in-progress", changedAt: new Date("2026-11-10T11:00:00Z"), changedBy: "technician@fixmate.com" },
          { status: "completed", changedAt: new Date("2026-11-10T15:30:00Z"), changedBy: "technician@fixmate.com" },
          { status: "paid", changedAt: new Date("2026-11-10T16:00:00Z"), changedBy: "customer@fixmate.com" }
        ]
      }
    ]

    await bookingsCol.insertMany(seedBookings)
    console.log(`Seeded ${seedBookings.length} connected bookings across all job pipeline statuses`)

    // 4. Seed Payment record for the paid booking
    const seedPayment = {
      _id: new ObjectId(),
      bookingId: booking5Id.toString(),
      serviceTitle: seedServices[8].title,
      customerName: "Tanvir Ahmed",
      customerEmail: "customer@fixmate.com",
      technicianName: seedServices[8].technicianName,
      technicianEmail: seedServices[8].technicianEmail,
      amount: 70,
      currency: "usd",
      transactionId: "pi_3Oqz25LkdIwHu7ix0pTEST01",
      stripeSessionId: "cs_test_seed_session_paid_001",
      paymentStatus: "paid",
      paidAt: new Date("2026-11-10T16:00:00Z")
    }

    await paymentsCol.insertOne(seedPayment)
    console.log("Seeded Stripe transaction for paid booking")

    console.log("\n🎉 Database successfully seeded with 100% realistic FixMate data!")
    console.log("----------------------------------------------------------------")
    console.log("Admin:      admin@fixmate.com")
    console.log("Technician: technician@fixmate.com")
    console.log("Technician: karim@fixmate.com")
    console.log("Customer:   customer@fixmate.com")
    console.log("Services:   14 approved + 1 pending")
    console.log("Bookings:   5 (requested, accepted, in-progress, completed/unpaid, completed/paid)")
    console.log("Payments:   1 completed transaction ($70.00)")
    console.log("----------------------------------------------------------------\n")
  } catch (error) {
    console.error("Error during database seeding:", error)
  } finally {
    await client.close()
  }
}

seed()
