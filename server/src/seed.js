require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Event = require('./models/Event');
const Booking = require('./models/Booking');
const { generateQRData, generateQRImage } = require('./utils/qrcode');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data for a fresh seed
    await Booking.deleteMany({});
    await Event.deleteMany({});
    await Employee.deleteMany({});
    console.log('Cleared existing data');

    // ── Employees ──
    const employees = [
      // Admins
      { employeeId: 'ADMIN001', name: 'Rajesh Kumar', email: 'rajesh.kumar@ust.com', password: 'admin123', department: 'IT Administration', phone: '+91 98765 43210', role: 'admin' },
      { employeeId: 'ADMIN002', name: 'Priya Nair', email: 'priya.nair@ust.com', password: 'admin123', department: 'HR Operations', phone: '+91 98765 43211', role: 'admin' },

      // Volunteers
      { employeeId: 'VOL001', name: 'Ananya Sharma', email: 'ananya.sharma@ust.com', password: 'vol123', department: 'Human Resources', phone: '+91 91234 56701', role: 'volunteer' },
      { employeeId: 'VOL002', name: 'Karthik Menon', email: 'karthik.menon@ust.com', password: 'vol123', department: 'Facilities', phone: '+91 91234 56702', role: 'volunteer' },
      { employeeId: 'VOL003', name: 'Divya Pillai', email: 'divya.pillai@ust.com', password: 'vol123', department: 'Admin Support', phone: '+91 91234 56703', role: 'volunteer' },

      // Employees — Engineering
      { employeeId: 'EMP001', name: 'Arun Bhaskar', email: 'arun.bhaskar@ust.com', password: 'emp123', department: 'Engineering', phone: '+91 90000 10001', role: 'employee' },
      { employeeId: 'EMP002', name: 'Sneha Reddy', email: 'sneha.reddy@ust.com', password: 'emp123', department: 'Engineering', phone: '+91 90000 10002', role: 'employee' },
      { employeeId: 'EMP003', name: 'Vikram Joshi', email: 'vikram.joshi@ust.com', password: 'emp123', department: 'Engineering', phone: '+91 90000 10003', role: 'employee' },
      { employeeId: 'EMP004', name: 'Meera Krishnan', email: 'meera.krishnan@ust.com', password: 'emp123', department: 'Engineering', phone: '+91 90000 10004', role: 'employee' },
      { employeeId: 'EMP005', name: 'Rohit Verma', email: 'rohit.verma@ust.com', password: 'emp123', department: 'Engineering', phone: '+91 90000 10005', role: 'employee' },

      // Employees — Design
      { employeeId: 'EMP006', name: 'Lakshmi Iyer', email: 'lakshmi.iyer@ust.com', password: 'emp123', department: 'Design', phone: '+91 90000 10006', role: 'employee' },
      { employeeId: 'EMP007', name: 'Arjun Nambiar', email: 'arjun.nambiar@ust.com', password: 'emp123', department: 'Design', phone: '+91 90000 10007', role: 'employee' },

      // Employees — QA
      { employeeId: 'EMP008', name: 'Pooja Gupta', email: 'pooja.gupta@ust.com', password: 'emp123', department: 'Quality Assurance', phone: '+91 90000 10008', role: 'employee' },
      { employeeId: 'EMP009', name: 'Sanjay Patel', email: 'sanjay.patel@ust.com', password: 'emp123', department: 'Quality Assurance', phone: '+91 90000 10009', role: 'employee' },

      // Employees — Product
      { employeeId: 'EMP010', name: 'Nisha Thomas', email: 'nisha.thomas@ust.com', password: 'emp123', department: 'Product Management', phone: '+91 90000 10010', role: 'employee' },
      { employeeId: 'EMP011', name: 'Deepak Srinivasan', email: 'deepak.s@ust.com', password: 'emp123', department: 'Product Management', phone: '+91 90000 10011', role: 'employee' },

      // Employees — Finance
      { employeeId: 'EMP012', name: 'Kavitha Rao', email: 'kavitha.rao@ust.com', password: 'emp123', department: 'Finance', phone: '+91 90000 10012', role: 'employee' },
      { employeeId: 'EMP013', name: 'Suresh Menon', email: 'suresh.menon@ust.com', password: 'emp123', department: 'Finance', phone: '+91 90000 10013', role: 'employee' },

      // Employees — Marketing
      { employeeId: 'EMP014', name: 'Riya Chopra', email: 'riya.chopra@ust.com', password: 'emp123', department: 'Marketing', phone: '+91 90000 10014', role: 'employee' },
      { employeeId: 'EMP015', name: 'Amit Das', email: 'amit.das@ust.com', password: 'emp123', department: 'Marketing', phone: '+91 90000 10015', role: 'employee' },

      // Employees — Operations
      { employeeId: 'EMP016', name: 'Swathi Naidu', email: 'swathi.naidu@ust.com', password: 'emp123', department: 'Operations', phone: '+91 90000 10016', role: 'employee' },
      { employeeId: 'EMP017', name: 'Manoj Tiwari', email: 'manoj.tiwari@ust.com', password: 'emp123', department: 'Operations', phone: '+91 90000 10017', role: 'employee' },

      // Employees — Sales
      { employeeId: 'EMP018', name: 'Fatima Sheikh', email: 'fatima.sheikh@ust.com', password: 'emp123', department: 'Sales', phone: '+91 90000 10018', role: 'employee' },
      { employeeId: 'EMP019', name: 'Rahul Saxena', email: 'rahul.saxena@ust.com', password: 'emp123', department: 'Sales', phone: '+91 90000 10019', role: 'employee' },
      { employeeId: 'EMP020', name: 'Aditi Kulkarni', email: 'aditi.kulkarni@ust.com', password: 'emp123', department: 'Sales', phone: '+91 90000 10020', role: 'employee' },
    ];

    let createdCount = 0;
    const employeeMap = {};
    for (const emp of employees) {
      let existing = await Employee.findOne({ employeeId: emp.employeeId });
      if (!existing) {
        existing = await Employee.create(emp);
        createdCount++;
      }
      employeeMap[emp.employeeId] = existing;
    }
    console.log(`Employees: ${createdCount} created, ${employees.length - createdCount} already existed`);

    // ── Events ──
    const admin = employeeMap['ADMIN001'];

    const events = [
      {
        title: 'Diwali Celebration 2026',
        description: 'Join us for the grand Diwali celebration with traditional food, music, rangoli, and festivities! Bring your family and enjoy an evening of lights and joy.',
        eventDate: new Date('2026-10-20'),
        venue: 'Main Auditorium, Building A',
        registrationStart: new Date('2026-06-15'),
        registrationEnd: new Date('2026-10-18'),
        maxCapacity: 5000,
        foodOptions: [
          { name: 'Vegetarian', description: 'Pure veg thali with sweets' },
          { name: 'Non-Vegetarian', description: 'Non-veg thali with sweets' },
          { name: 'Vegan', description: 'Plant-based meal with sweets' },
          { name: 'Jain', description: 'Jain-friendly meal without root vegetables' },
        ],
        status: 'active',
        createdBy: admin._id,
      },
      {
        title: 'Christmas Party 2026',
        description: 'Celebrate the holiday season with Secret Santa, cake, carols, and a special dinner. Ugly sweater contest with prizes!',
        eventDate: new Date('2026-12-23'),
        venue: 'Cafeteria Hall, Building B',
        registrationStart: new Date('2026-11-01'),
        registrationEnd: new Date('2026-12-20'),
        maxCapacity: 3000,
        foodOptions: [
          { name: 'Vegetarian', description: 'Veg platter with Christmas cake' },
          { name: 'Non-Vegetarian', description: 'Turkey dinner with Christmas cake' },
          { name: 'Vegan', description: 'Plant-based holiday platter' },
        ],
        status: 'active',
        createdBy: admin._id,
      },
      {
        title: 'Onam Sadya 2026',
        description: 'Experience the grand Onam Sadya served on banana leaves! Traditional Kerala feast with 26 dishes, Pookalam, and Thiruvathira dance.',
        eventDate: new Date('2026-08-26'),
        venue: 'Open Ground, Campus 2',
        registrationStart: new Date('2026-06-10'),
        registrationEnd: new Date('2026-08-24'),
        maxCapacity: 4000,
        foodOptions: [
          { name: 'Traditional Sadya', description: 'Full 26-dish banana leaf sadya' },
          { name: 'Mini Sadya', description: 'Lighter version with 15 dishes' },
        ],
        status: 'active',
        createdBy: admin._id,
      },
      {
        title: 'Pongal Celebration 2027',
        description: 'Celebrate the harvest festival with sugarcane, Pongal cooking, kolam competition, and cultural performances.',
        eventDate: new Date('2027-01-14'),
        venue: 'Convention Center, Tower C',
        registrationStart: new Date('2026-12-01'),
        registrationEnd: new Date('2027-01-12'),
        maxCapacity: 2500,
        foodOptions: [
          { name: 'Vegetarian', description: 'Traditional Pongal thali' },
          { name: 'Non-Vegetarian', description: 'Non-veg Chettinad thali' },
        ],
        status: 'draft',
        createdBy: admin._id,
      },
      {
        title: 'Independence Day Lunch 2026',
        description: 'Patriotic celebration with tricolor-themed lunch, flag hoisting, and cultural programs. All employees welcome!',
        eventDate: new Date('2026-08-15'),
        venue: 'Main Lawn, Building A',
        registrationStart: new Date('2026-07-15'),
        registrationEnd: new Date('2026-08-13'),
        maxCapacity: 6000,
        foodOptions: [
          { name: 'North Indian', description: 'Chole bhature, biryani, gulab jamun' },
          { name: 'South Indian', description: 'Dosa, sambar rice, payasam' },
          { name: 'Street Food', description: 'Pani puri, chaat, vada pav' },
        ],
        status: 'active',
        createdBy: admin._id,
      },
      {
        title: 'Holi Celebration 2026',
        description: 'Colors of joy! Celebrate Holi with organic colors, thandai, and a grand lunch. Registration is now closed.',
        eventDate: new Date('2026-03-14'),
        venue: 'Sports Ground, Campus 1',
        registrationStart: new Date('2026-02-01'),
        registrationEnd: new Date('2026-03-12'),
        maxCapacity: 3500,
        foodOptions: [
          { name: 'Vegetarian', description: 'Holi special thali with thandai' },
          { name: 'Non-Vegetarian', description: 'Non-veg thali with thandai' },
        ],
        status: 'active',
        createdBy: admin._id,
      },
    ];

    let eventCount = 0;
    const eventMap = {};
    for (const evt of events) {
      let existing = await Event.findOne({ title: evt.title });
      if (!existing) {
        existing = await Event.create(evt);
        eventCount++;
      }
      eventMap[evt.title] = existing;
    }
    console.log(`Events: ${eventCount} created, ${events.length - eventCount} already existed`);

    // ── Bookings (for Diwali & Onam — active events with open registration) ──
    const diwali = eventMap['Diwali Celebration 2026'];
    const onam = eventMap['Onam Sadya 2026'];
    const indDay = eventMap['Independence Day Lunch 2026'];

    const bookingData = [
      // Diwali bookings
      { empId: 'EMP001', event: diwali, food: 'Vegetarian' },
      { empId: 'EMP002', event: diwali, food: 'Non-Vegetarian' },
      { empId: 'EMP003', event: diwali, food: 'Vegetarian' },
      { empId: 'EMP004', event: diwali, food: 'Vegan' },
      { empId: 'EMP005', event: diwali, food: 'Non-Vegetarian' },
      { empId: 'EMP006', event: diwali, food: 'Jain' },
      { empId: 'EMP007', event: diwali, food: 'Vegetarian' },
      { empId: 'EMP008', event: diwali, food: 'Non-Vegetarian' },
      { empId: 'EMP010', event: diwali, food: 'Vegetarian' },
      { empId: 'EMP012', event: diwali, food: 'Non-Vegetarian' },
      { empId: 'EMP014', event: diwali, food: 'Vegan' },
      { empId: 'EMP015', event: diwali, food: 'Vegetarian' },
      { empId: 'VOL001', event: diwali, food: 'Vegetarian' },
      { empId: 'VOL002', event: diwali, food: 'Non-Vegetarian' },

      // Onam bookings
      { empId: 'EMP001', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP002', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP004', event: onam, food: 'Mini Sadya' },
      { empId: 'EMP006', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP009', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP010', event: onam, food: 'Mini Sadya' },
      { empId: 'EMP011', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP013', event: onam, food: 'Mini Sadya' },
      { empId: 'EMP016', event: onam, food: 'Traditional Sadya' },
      { empId: 'EMP018', event: onam, food: 'Traditional Sadya' },

      // Independence Day bookings
      { empId: 'EMP001', event: indDay, food: 'North Indian' },
      { empId: 'EMP003', event: indDay, food: 'South Indian' },
      { empId: 'EMP005', event: indDay, food: 'Street Food' },
      { empId: 'EMP007', event: indDay, food: 'North Indian' },
      { empId: 'EMP008', event: indDay, food: 'South Indian' },
      { empId: 'EMP011', event: indDay, food: 'Street Food' },
      { empId: 'EMP013', event: indDay, food: 'North Indian' },
      { empId: 'EMP015', event: indDay, food: 'South Indian' },
      { empId: 'EMP017', event: indDay, food: 'Street Food' },
      { empId: 'EMP019', event: indDay, food: 'North Indian' },
      { empId: 'EMP020', event: indDay, food: 'South Indian' },
    ];

    let bookingCount = 0;
    let checkedInCount = 0;
    for (const b of bookingData) {
      const emp = employeeMap[b.empId];
      if (!emp || !b.event) continue;

      const exists = await Booking.findOne({ employee: emp._id, event: b.event._id });
      if (exists) continue;

      const tempId = new mongoose.Types.ObjectId();
      const qrData = generateQRData(tempId.toString(), emp.employeeId, b.event._id.toString());
      const qrCode = await generateQRImage(qrData);

      await Booking.create({
        _id: tempId,
        employee: emp._id,
        event: b.event._id,
        foodPreference: b.food,
        qrData,
        qrCode,
        status: 'confirmed',
      });
      bookingCount++;
    }
    console.log(`Bookings: ${bookingCount} created with QR codes`);

    // Mark a few Diwali bookings as checked_in (to show scanner flow works)
    const checkedInEmps = ['EMP001', 'EMP002', 'EMP003'];
    for (const empId of checkedInEmps) {
      const emp = employeeMap[empId];
      if (!emp || !diwali) continue;
      const booking = await Booking.findOne({ employee: emp._id, event: diwali._id });
      if (booking && booking.status === 'confirmed') {
        booking.status = 'checked_in';
        booking.checkedInAt = new Date();
        booking.checkedInBy = admin._id;
        await booking.save();
        checkedInCount++;
      }
    }
    console.log(`Check-ins: ${checkedInCount} bookings marked as checked_in`);

    // ── Summary ──
    console.log('\n═══════════════════════════════════════');
    console.log('  SEED DATA SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log('\n  ADMIN ACCOUNTS:');
    console.log('  ┌──────────────┬────────────┐');
    console.log('  │ ADMIN001     │ admin123   │  Rajesh Kumar (IT)');
    console.log('  │ ADMIN002     │ admin123   │  Priya Nair (HR)');
    console.log('  └──────────────┴────────────┘');
    console.log('\n  VOLUNTEER ACCOUNTS:');
    console.log('  ┌──────────────┬────────────┐');
    console.log('  │ VOL001       │ vol123     │  Ananya Sharma');
    console.log('  │ VOL002       │ vol123     │  Karthik Menon');
    console.log('  │ VOL003       │ vol123     │  Divya Pillai');
    console.log('  └──────────────┴────────────┘');
    console.log('\n  EMPLOYEE ACCOUNTS (EMP001–EMP020):');
    console.log('  Password: emp123 (same for all)');
    console.log('  Departments: Engineering, Design, QA,');
    console.log('    Product, Finance, Marketing, Ops, Sales');
    console.log('\n  EVENTS:');
    console.log('  • Diwali Celebration 2026     (active, 14 bookings, 3 checked in)');
    console.log('  • Christmas Party 2026        (active, no bookings yet)');
    console.log('  • Onam Sadya 2026             (active, 10 bookings)');
    console.log('  • Independence Day Lunch 2026 (active, 11 bookings)');
    console.log('  • Holi Celebration 2026       (CLOSED — past registration)');
    console.log('  • Pongal Celebration 2027     (draft)');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
