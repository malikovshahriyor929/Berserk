// import "dotenv/config";
// import { PrismaPg } from "@prisma/adapter-pg";

// // ✅ IMPORTANT: use your generated prisma client path
// import { PrismaClient } from "../src/generated/prisma/client.js";

// const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
// const prisma = new PrismaClient({ adapter });

// async function main() {
//   const author = await prisma.user.upsert({
//     where: { email: "author@test.com" },
//     update: {},
//     create: {
//       email: "author@test.com",
//       name: "Test Author",
//       role: "AUTHOR",
//       passwordHash: "demo_hash",
//     },
//   });

//   const book = await prisma.book.create({
//     data: {
//       title: "My First Book",
//       description: "Seeded demo book",
//       status: "PUBLISHED",
//       visibility: "PUBLIC",
//       monetization: "FREE",
//       authorId: author.id, // if your Book has authorId
//     },
//   });

//   await prisma.chapter.createMany({
//     data: [
//       { bookId: book.id, title: "Chapter 1", order: 1, content: "Hello", isPreview: true },
//       { bookId: book.id, title: "Chapter 2", order: 2, content: "World", isPreview: false },
//     ],
//   });

//   console.log("Seed done ✅");
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function pickManyUnique<T>(arr: T[], min: number, max: number) {
  const count = faker.number.int({ min, max });
  const pool = [...arr];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const idx = faker.number.int({ min: 0, max: pool.length - 1 });
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

async function main() {
  const AUTHORS_COUNT = 5;
  const BOOKS_PER_AUTHOR = 8;
  const READERS_COUNT = 25;

  // 0) Categories (Tag)
  const categoryNames = [
    "Fiction",
    "Fantasy",
    "Romance",
    "Science Fiction",
    "Thriller",
    "Mystery",
    "Historical",
    "Biography",
    "Self Help",
    "Business",
    "Programming",
    "Design",
    "Health",
    "Kids",
  ];

  const categories = [];
  for (const name of categoryNames) {
    const tag = await prisma.tag.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categories.push(tag);
  }

  // 0.1) Readers (ratings uchun)
  const readers = [];
  for (let i = 0; i < READERS_COUNT; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const email = `reader${i + 1}@test.com`;

    const reader = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${first} ${last}`,
        role: "USER",
        passwordHash: "demo_hash",
      },
    });

    readers.push(reader);
  }

  // 1) Authors yaratamiz
  const authors = [];
  for (let i = 0; i < AUTHORS_COUNT; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const email = faker.internet.email({ firstName: first, lastName: last }).toLowerCase();

    const author = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${first} ${last}`,
        role: "AUTHOR",
        passwordHash: "demo_hash", // real loyihada bcrypt bilan
      },
    });

    authors.push(author);
  }

  // 2) Books + Chapters
  const monetizations = ["FREE", "BUY_ONLY", "RENT_ONLY", "BUY_AND_RENT"] as const;

  for (const author of authors) {
    for (let b = 0; b < BOOKS_PER_AUTHOR; b++) {
      const monetization = pick([...monetizations]);

      const buyPriceCents =
        monetization === "BUY_ONLY" || monetization === "BUY_AND_RENT"
          ? faker.number.int({ min: 1500, max: 99000 })
          : null;

      const rentPriceCents =
        monetization === "RENT_ONLY" || monetization === "BUY_AND_RENT"
          ? faker.number.int({ min: 500, max: 49000 })
          : null;

      const rentDurationDays =
        monetization === "RENT_ONLY" || monetization === "BUY_AND_RENT"
          ? pick([3, 7, 14, 30])
          : null;

      const pickedCategories = pickManyUnique(categories, 1, 3);
      const pickedReaders = pickManyUnique(readers, 3, 10);
      const primaryCategory = pickedCategories[0]?.name ?? null;

      const book = await prisma.book.create({
        data: {
          title: faker.book.title(),
          description: faker.lorem.paragraphs({ min: 1, max: 2 }),
          coverUrl: faker.image.urlLoremFlickr({ category: "book" }),
          language: pick(["en", "uz", "ru"]),
          category: primaryCategory,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          monetization,
          buyPriceCents,
          rentPriceCents,
          rentDurationDays,
          currency: "UZS",
          publishedAt: new Date(),
          authorId: author.id,
          tags: {
            create: pickedCategories.map((tag) => ({
              tag: { connect: { id: tag.id } },
            })),
          },
          reviews: {
            create: pickedReaders.map((reader) => ({
              user: { connect: { id: reader.id } },
              rating: faker.number.int({ min: 1, max: 5 }),
              title: faker.lorem.words({ min: 2, max: 5 }),
              body: faker.lorem.paragraphs({ min: 1, max: 2 }),
            })),
          },
        },
      });

      // 6-20 ta chapter
      const chaptersCount = faker.number.int({ min: 6, max: 20 });
      const chaptersData = Array.from({ length: chaptersCount }).map((_, idx) => ({
        bookId: book.id,
        title: `Chapter ${idx + 1}: ${faker.lorem.words({ min: 2, max: 6 })}`,
        order: idx + 1,
        content: faker.lorem.paragraphs({ min: 3, max: 8 }),
        isPreview: idx === 0, // 1-chi chapter preview
      }));

      await prisma.chapter.createMany({ data: chaptersData });
    }
  }

  console.log("Real-like seed done ✅");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
