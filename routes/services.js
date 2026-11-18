import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections } from '../config/db.js'
import { verifyToken, verifyTechnician } from '../middlewares/auth.js'

const router = Router()

// Escape regex characters safely
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Comprehensive synonyms & relatable category mapping
const SYNONYMS = {
  mobile: ['Smartphone', 'phone'],
  cell: ['Smartphone', 'phone'],
  cellphone: ['Smartphone', 'phone'],
  phone: ['Smartphone', 'iPhone', 'Galaxy'],
  android: ['Smartphone', 'Samsung'],
  iphone: ['Smartphone', 'Apple', 'OLED'],
  fridge: ['Refrigerator', 'freezer'],
  freeze: ['Refrigerator', 'freezer'],
  freezer: ['Refrigerator'],
  cooling: ['Refrigerator', 'AC'],
  cool: ['AC', 'Refrigerator'],
  aircon: ['AC'],
  cooler: ['AC'],
  computer: ['Laptop & PC', 'desktop'],
  pc: ['Laptop & PC', 'desktop'],
  laptop: ['Laptop & PC', 'MacBook'],
  desktop: ['Laptop & PC'],
  mac: ['MacBook', 'Laptop & PC'],
  macbook: ['Laptop & PC'],
  television: ['TV', 'screen', 'LED'],
  tv: ['TV', 'screen', 'LED'],
  screen: ['OLED', 'display', 'TV'],
  display: ['OLED', 'screen'],
  wire: ['Electrical', 'rewiring', 'circuit'],
  wiring: ['Electrical', 'circuit'],
  electric: ['Electrical'],
  electrical: ['Electrical'],
  switch: ['Electrical', 'Board'],
  meter: ['Electrical', 'Sub-Meter'],
  washer: ['Washing Machine'],
  washing: ['Washing Machine'],
  laundry: ['Washing Machine'],
}

function getRelatableTerms(cleanSearch) {
  const terms = new Set()
  const lower = cleanSearch.toLowerCase()
  for (const [key, relatedList] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) {
      relatedList.forEach(r => terms.add(r))
    }
  }
  return Array.from(terms)
}

/**
 * GET /api/services/featured
 * Get 6 latest approved and available services for Home page
 */
router.get('/featured', async (req, res) => {
  try {
    const { services } = getCollections()
    const featured = await services
      .find({ approvalStatus: 'approved', isAvailable: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray()

    return res.json({ success: true, services: featured })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch featured services', error: error.message })
  }
})

/**
 * GET /api/services
 * Challenge 1: Server-side search, filter, sort and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { services } = getCollections()
    const {
      search = '',
      category = '',
      serviceMode = '',
      sort = 'newest',
      page = 1,
      limit = 9
    } = req.query

    // Public query always requires approved & available
    const query = {
      approvalStatus: 'approved',
      isAvailable: true
    }

    // Escape regex characters safely
    const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Search query (matches title, category, description, technicianName, serviceMode, area)
    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim()
      const escapedFull = escapeRegex(cleanSearch)
      
      // Tokenize into clean words
      const words = cleanSearch
        .split(/\s+/)
        .map(w => w.replace(/^[^\w]+|[^\w]+$/g, ''))
        .filter(w => w.length > 0)
        .map(w => {
          const esc = escapeRegex(w)
          // Word boundary for short words (<= 3 chars, e.g. 'ac', 'tv', 'pc') so 'ac' doesn't match 'macbook'
          return w.length <= 3 ? `\\b${esc}\\b` : esc
        })

      const searchableFields = ['title', 'category', 'description', 'technicianName', 'serviceMode', 'area']

      if (words.length <= 1) {
        query.$or = searchableFields.map(f => ({
          [f]: { $regex: new RegExp(escapedFull, 'i') }
        }))
      } else {
        // Multi-word search: Match exact phrase OR all individual keywords ($and)
        const phraseOr = searchableFields.map(f => ({
          [f]: { $regex: new RegExp(escapedFull, 'i') }
        }))

        const allWordsAnd = words.map(wordPattern => ({
          $or: searchableFields.map(f => ({
            [f]: { $regex: new RegExp(wordPattern, 'i') }
          }))
        }))

        query.$or = [
          ...phraseOr,
          { $and: allWordsAnd }
        ]
      }
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category
    }

    // Service Mode filter
    if (serviceMode && serviceMode !== 'all') {
      query.serviceMode = serviceMode
    }

    // Sorting
    let sortQuery = { createdAt: -1 }
    if (sort === 'price-asc') {
      sortQuery = { basePrice: 1 }
    } else if (sort === 'price-desc') {
      sortQuery = { basePrice: -1 }
    } else if (sort === 'newest') {
      sortQuery = { createdAt: -1 }
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSize = Math.max(1, parseInt(limit, 10) || 9)
    const skip = (pageNumber - 1) * pageSize

    let [serviceList, totalCount] = await Promise.all([
      services.find(query).sort(sortQuery).skip(skip).limit(pageSize).toArray(),
      services.countDocuments(query)
    ])

    let isRelatable = false

    // Relatable Fallback: If no direct matches and a search term was entered, find relatable services
    if (totalCount === 0 && search && String(search).trim()) {
      const cleanSearch = String(search).trim()
      const relatableKeywords = getRelatableTerms(cleanSearch)
      const relatableConditions = []

      // 1. Relatable synonyms and category keywords
      relatableKeywords.forEach(term => {
        const esc = escapeRegex(term)
        searchableFields.forEach(f => {
          relatableConditions.push({ [f]: { $regex: new RegExp(esc, 'i') } })
        })
      })

      // 2. Relatable individual words
      const words = cleanSearch
        .split(/\s+/)
        .map(w => w.replace(/^[^\w]+|[^\w]+$/g, ''))
        .filter(w => w.length > 1)

      words.forEach(word => {
        const esc = escapeRegex(word)
        const pattern = word.length <= 3 ? `\\b${esc}\\b` : esc
        searchableFields.forEach(f => {
          relatableConditions.push({ [f]: { $regex: new RegExp(pattern, 'i') } })
        })
      })

      if (relatableConditions.length > 0) {
        const relatableQuery = {
          approvalStatus: 'approved',
          isAvailable: true,
          $or: relatableConditions
        }

        const [relatableList, relatableCount] = await Promise.all([
          services.find(relatableQuery).sort(sortQuery).skip(skip).limit(pageSize).toArray(),
          services.countDocuments(relatableQuery)
        ])

        if (relatableCount > 0) {
          serviceList = relatableList
          totalCount = relatableCount
          isRelatable = true
        }
      }
    }

    return res.json({
      success: true,
      services: serviceList,
      isRelatable,
      pagination: {
        total: totalCount,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch services', error: error.message })
  }
})

/**
 * GET /api/services/technician/my
 * Get all services created by the logged-in technician
 */
router.get('/technician/my', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { services } = getCollections()
    const technicianEmail = req.user.email

    const myServices = await services
      .find({ technicianEmail })
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, services: myServices })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch technician services', error: error.message })
  }
})

/**
 * GET /api/services/:id
 * Get single service details + technician summary
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services, users } = getCollections()
    const service = await services.findOne({ _id: new ObjectId(id) })

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    // Technician summary lookup
    let technicianSummary = null
    if (service.technicianEmail) {
      const technician = await users.findOne({ email: service.technicianEmail })
      if (technician) {
        technicianSummary = {
          name: technician.name || service.technicianName,
          email: technician.email,
          image: technician.image || null,
          area: technician.area || service.serviceArea,
          bio: technician.bio || 'Professional FixMate Certified Technician',
          phone: technician.phone || null,
          plan: technician.plan || 'free',
          isPro: technician.plan === 'pro'
        }
      }
    }

    return res.json({
      success: true,
      service,
      technician: technicianSummary
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch service details', error: error.message })
  }
})

/**
 * POST /api/services
 * Create a new service (Technician only)
 */
router.post('/', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea
    } = req.body

    if (!title || !category || !description || !image || !basePrice || !serviceMode || !serviceArea) {
      return res.status(400).json({
        success: false,
        message: 'All fields (title, category, description, image, basePrice, serviceMode, serviceArea) are required'
      })
    }

    const numericPrice = parseFloat(basePrice)
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Base price must be a positive number' })
    }

    const { services, users } = getCollections()

    // Optional Feature 1: Free vs Pro Plan service count enforcement
    const technicianDoc = await users.findOne({ email: req.user.email })
    const isPro = technicianDoc?.plan === 'pro'
    if (!isPro) {
      const currentServiceCount = await services.countDocuments({ technicianEmail: req.user.email })
      if (currentServiceCount >= 3) {
        return res.status(403).json({
          success: false,
          isLimitReached: true,
          message: 'Free technician plan is limited to 3 services. Upgrade to Pro for unlimited service listings and a Verified Pro badge!'
        })
      }
    }

    const newService = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      image: image.trim(),
      basePrice: numericPrice,
      estimatedDuration: estimatedDuration ? estimatedDuration.trim() : '1-2 hours',
      serviceMode: serviceMode.trim(),
      serviceArea: serviceArea.trim(),
      technicianName: req.user.name || 'Technician',
      technicianEmail: req.user.email,
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await services.insertOne(newService)

    return res.status(201).json({
      success: true,
      message: 'Service created successfully and waiting for admin approval',
      serviceId: result.insertedId,
      service: { ...newService, _id: result.insertedId }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create service', error: error.message })
  }
})

/**
 * PATCH /api/services/:id
 * Update service details (Technician only). Resets approvalStatus to 'pending'
 */
router.patch('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services } = getCollections()
    const existing = await services.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    // Owner validation
    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own services' })
    }

    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea
    } = req.body

    const updateDoc = {
      updatedAt: new Date(),
      approvalStatus: 'pending' // Rule: editing resets approvalStatus to pending
    }

    if (title) updateDoc.title = title.trim()
    if (category) updateDoc.category = category.trim()
    if (description) updateDoc.description = description.trim()
    if (image) updateDoc.image = image.trim()
    if (basePrice !== undefined) {
      const price = parseFloat(basePrice)
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, message: 'Base price must be a positive number' })
      }
      updateDoc.basePrice = price
    }
    if (estimatedDuration) updateDoc.estimatedDuration = estimatedDuration.trim()
    if (serviceMode) updateDoc.serviceMode = serviceMode.trim()
    if (serviceArea) updateDoc.serviceArea = serviceArea.trim()

    await services.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc })

    return res.json({
      success: true,
      message: 'Service updated successfully and resubmitted for admin approval',
      updatedFields: updateDoc
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update service', error: error.message })
  }
})

/**
 * PATCH /api/services/:id/availability
 * Toggle service isAvailable true/false (Technician only)
 */
router.patch('/:id/availability', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services } = getCollections()
    const existing = await services.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only change availability of your own services' })
    }

    const newAvailability = req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : !existing.isAvailable

    await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAvailable: newAvailability, updatedAt: new Date() } }
    )

    return res.json({
      success: true,
      message: `Service availability set to ${newAvailability ? 'available' : 'unavailable'}`,
      isAvailable: newAvailability
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle availability', error: error.message })
  }
})

/**
 * DELETE /api/services/:id
 * Delete a service (Technician only)
 */
router.delete('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services } = getCollections()
    const existing = await services.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own services' })
    }

    await services.deleteOne({ _id: new ObjectId(id) })

    return res.json({ success: true, message: 'Service deleted successfully' })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete service', error: error.message })
  }
})

export default router
