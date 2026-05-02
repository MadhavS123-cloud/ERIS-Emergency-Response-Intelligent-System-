import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Real hospitals in Bengaluru with actual coordinates
const REAL_HOSPITALS = [
  {
    name: 'Sri Sathya Sai Super Speciality Hospital',
    address: 'Whitefield, Bengaluru, Karnataka 560066',
    locationLat: 12.9785,
    locationLng: 77.7262,
    icuBedsAvailable: 24,
    generalBedsAvailable: 120,
    ventilatorsAvailable: 15,
    staffEmail: 'sathyasai@eris.com',
    staffName: 'Sai Hospital Admin',
    staffPhone: '9000001001'
  },
  {
    name: 'Vydehi Institute of Medical Sciences',
    address: '82, EPIP Area, Whitefield, Bengaluru 560066',
    locationLat: 12.9760,
    locationLng: 77.7215,
    icuBedsAvailable: 45,
    generalBedsAvailable: 180,
    ventilatorsAvailable: 25,
    staffEmail: 'vydehi@eris.com',
    staffName: 'Vydehi Admin',
    staffPhone: '9000001002'
  },
  {
    name: 'Apollo Hospitals Whitefield',
    address: 'No. 1, Old Airport Road, Bengaluru 560017',
    locationLat: 12.9647,
    locationLng: 77.7176,
    icuBedsAvailable: 30,
    generalBedsAvailable: 150,
    ventilatorsAvailable: 20,
    staffEmail: 'apollo@eris.com',
    staffName: 'Apollo Admin',
    staffPhone: '9000001003'
  },
  {
    name: 'Columbia Asia Hospital Whitefield',
    address: 'ITPL Road, Whitefield, Bengaluru 560066',
    locationLat: 12.9694,
    locationLng: 77.7497,
    icuBedsAvailable: 20,
    generalBedsAvailable: 100,
    ventilatorsAvailable: 12,
    staffEmail: 'columbia@eris.com',
    staffName: 'Columbia Admin',
    staffPhone: '9000001004'
  },
  {
    name: 'Manipal Hospital Whitefield',
    address: 'Varthur Hobli, Whitefield, Bengaluru 560066',
    locationLat: 12.9796,
    locationLng: 77.7379,
    icuBedsAvailable: 35,
    generalBedsAvailable: 140,
    ventilatorsAvailable: 18,
    staffEmail: 'manipal@eris.com',
    staffName: 'Manipal Admin',
    staffPhone: '9000001005'
  },
  {
    name: 'Fortis Hospital Bannerghatta',
    address: '154/9, Bannerghatta Road, Bengaluru 560076',
    locationLat: 12.9136,
    locationLng: 77.6098,
    icuBedsAvailable: 28,
    generalBedsAvailable: 110,
    ventilatorsAvailable: 15,
    staffEmail: 'fortis@eris.com',
    staffName: 'Fortis Admin',
    staffPhone: '9000001006'
  },
  {
    name: 'Narayana Health City',
    address: 'Bommasandra Industrial Area, Bengaluru 560099',
    locationLat: 12.9270,
    locationLng: 77.6808,
    icuBedsAvailable: 50,
    generalBedsAvailable: 200,
    ventilatorsAvailable: 30,
    staffEmail: 'narayana@eris.com',
    staffName: 'Narayana Admin',
    staffPhone: '9000001007'
  },
  {
    name: 'Sakra World Hospital',
    address: 'SY No 52/2 & 52/3, Devarabeesanahalli, Bengaluru 560103',
    locationLat: 12.9350,
    locationLng: 77.6950,
    icuBedsAvailable: 22,
    generalBedsAvailable: 95,
    ventilatorsAvailable: 14,
    staffEmail: 'sakra@eris.com',
    staffName: 'Sakra Admin',
    staffPhone: '9000001008'
  },
  {
    name: 'Aster CMI Hospital',
    address: 'No. 43/2, Sahakara Nagar, Bengaluru 560092',
    locationLat: 13.0450,
    locationLng: 77.5800,
    icuBedsAvailable: 18,
    generalBedsAvailable: 85,
    ventilatorsAvailable: 10,
    staffEmail: 'aster@eris.com',
    staffName: 'Aster Admin',
    staffPhone: '9000001009'
  },
  {
    name: 'Ramaiah Memorial Hospital',
    address: 'New BEL Road, Bengaluru 560054',
    locationLat: 13.0270,
    locationLng: 77.5640,
    icuBedsAvailable: 40,
    generalBedsAvailable: 160,
    ventilatorsAvailable: 22,
    staffEmail: 'ramaiah@eris.com',
    staffName: 'Ramaiah Admin',
    staffPhone: '9000001010'
  },
  {
    name: 'St. Johns Medical College Hospital',
    address: 'Koramangala, Bengaluru 560034',
    locationLat: 12.9330,
    locationLng: 77.6200,
    icuBedsAvailable: 32,
    generalBedsAvailable: 130,
    ventilatorsAvailable: 16,
    staffEmail: 'stjohns@eris.com',
    staffName: 'St Johns Admin',
    staffPhone: '9000001011'
  },
  {
    name: 'M S Ramaiah Medical College',
    address: 'MSR Nagar, Bengaluru 560054',
    locationLat: 13.0275,
    locationLng: 77.5645,
    icuBedsAvailable: 35,
    generalBedsAvailable: 145,
    ventilatorsAvailable: 20,
    staffEmail: 'msramaiah@eris.com',
    staffName: 'MS Ramaiah Admin',
    staffPhone: '9000001012'
  },
  {
    name: 'KIMS Hospital Bengaluru',
    address: 'KR Puram, Bengaluru 560036',
    locationLat: 13.0030,
    locationLng: 77.6700,
    icuBedsAvailable: 25,
    generalBedsAvailable: 105,
    ventilatorsAvailable: 14,
    staffEmail: 'kims@eris.com',
    staffName: 'KIMS Admin',
    staffPhone: '9000001013'
  },
  {
    name: 'Cloudnine Hospital Whitefield',
    address: 'ITPL Main Road, Whitefield, Bengaluru 560066',
    locationLat: 12.9720,
    locationLng: 77.7250,
    icuBedsAvailable: 12,
    generalBedsAvailable: 45,
    ventilatorsAvailable: 6,
    staffEmail: 'cloudnine@eris.com',
    staffName: 'Cloudnine Admin',
    staffPhone: '9000001014'
  },
  {
    name: 'Bowring & Lady Curzon Hospital',
    address: 'Shivaji Nagar, Bengaluru 560001',
    locationLat: 12.9830,
    locationLng: 77.6050,
    icuBedsAvailable: 15,
    generalBedsAvailable: 80,
    ventilatorsAvailable: 8,
    staffEmail: 'bowring@eris.com',
    staffName: 'Bowring Admin',
    staffPhone: '9000001015'
  },
  {
    name: 'Victoria Hospital',
    address: 'K.R. Market, Bengaluru 560002',
    locationLat: 12.9630,
    locationLng: 77.5850,
    icuBedsAvailable: 20,
    generalBedsAvailable: 100,
    ventilatorsAvailable: 12,
    staffEmail: 'victoria@eris.com',
    staffName: 'Victoria Admin',
    staffPhone: '9000001016'
  },
  {
    name: 'Mallya Hospital',
    address: 'Vittal Mallya Road, Bengaluru 560001',
    locationLat: 12.9750,
    locationLng: 77.6000,
    icuBedsAvailable: 18,
    generalBedsAvailable: 75,
    ventilatorsAvailable: 10,
    staffEmail: 'mallya@eris.com',
    staffName: 'Mallya Admin',
    staffPhone: '9000001017'
  },
  {
    name: 'BGS Gleneagles Global Hospitals',
    address: '67, Uttarahalli Main Road, Bengaluru 560060',
    locationLat: 12.9250,
    locationLng: 77.5450,
    icuBedsAvailable: 30,
    generalBedsAvailable: 125,
    ventilatorsAvailable: 18,
    staffEmail: 'bgs@eris.com',
    staffName: 'BGS Admin',
    staffPhone: '9000001018'
  },
  {
    name: 'HCG Cancer Centre Bengaluru',
    address: '8, HCG Towers, P Kalinga Rao Road, Bengaluru 560027',
    locationLat: 12.9430,
    locationLng: 77.5950,
    icuBedsAvailable: 22,
    generalBedsAvailable: 90,
    ventilatorsAvailable: 14,
    staffEmail: 'hcg@eris.com',
    staffName: 'HCG Admin',
    staffPhone: '9000001019'
  },
  {
    name: 'Sparsh Hospital',
    address: 'Infantry Road, Bengaluru 560001',
    locationLat: 12.9800,
    locationLng: 77.6100,
    icuBedsAvailable: 16,
    generalBedsAvailable: 70,
    ventilatorsAvailable: 9,
    staffEmail: 'sparsh@eris.com',
    staffName: 'Sparsh Admin',
    staffPhone: '9000001020'
  }
];

async function main() {
  console.log('🚀 Seeding real Bengaluru hospitals...');
  
  const password = await bcrypt.hash('password123', 10);
  let created = 0;
  let updated = 0;

  for (const hospitalData of REAL_HOSPITALS) {
    const bedCapacity = hospitalData.icuBedsAvailable + hospitalData.generalBedsAvailable;
    const hospitalId = `hosp-${hospitalData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;

    try {
      const hospital = await prisma.hospital.upsert({
        where: { id: hospitalId },
        update: {
          name: hospitalData.name,
          address: hospitalData.address,
          locationLat: hospitalData.locationLat,
          locationLng: hospitalData.locationLng,
          bedCapacity,
          icuBedsAvailable: hospitalData.icuBedsAvailable,
          generalBedsAvailable: hospitalData.generalBedsAvailable,
          ventilatorsAvailable: hospitalData.ventilatorsAvailable
        },
        create: {
          id: hospitalId,
          name: hospitalData.name,
          address: hospitalData.address,
          locationLat: hospitalData.locationLat,
          locationLng: hospitalData.locationLng,
          bedCapacity,
          icuBedsAvailable: hospitalData.icuBedsAvailable,
          generalBedsAvailable: hospitalData.generalBedsAvailable,
          ventilatorsAvailable: hospitalData.ventilatorsAvailable
        }
      });

      // Create or update hospital staff user
      await prisma.user.upsert({
        where: { email: hospitalData.staffEmail },
        update: {
          name: hospitalData.staffName,
          password,
          role: 'HOSPITAL',
          hospitalId: hospital.id,
          phone: hospitalData.staffPhone
        },
        create: {
          email: hospitalData.staffEmail,
          name: hospitalData.staffName,
          password,
          role: 'HOSPITAL',
          hospitalId: hospital.id,
          phone: hospitalData.staffPhone
        }
      });

      if (created || updated) {
        // Check if it was created or updated
        const existing = await prisma.hospital.findUnique({ where: { id: hospitalId } });
        if (existing.createdAt === existing.updatedAt) {
          created++;
        } else {
          updated++;
        }
      }
      
      console.log(`✅ ${hospitalData.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed ${hospitalData.name}:`, error.message);
    }
  }

  console.log(`\n🎉 Successfully seeded ${REAL_HOSPITALS.length} real hospitals`);
  console.log(`   Created: ${created}, Updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
