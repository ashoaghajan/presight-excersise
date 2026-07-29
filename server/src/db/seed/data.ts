/**
 * Static catalogues the seeder draws from. Data only — no logic.
 *
 * Three properties are deliberate:
 *
 * 1. **Names are tied to nationality.** Each nationality carries its own name
 *    pools, so the directory does not end up with an Emirati called "Hans
 *    Müller". A demo that looks plausible is worth the extra table.
 *
 * 2. **Everything is weighted.** A uniform distribution would give all 24
 *    nationalities and all 44 hobbies near-identical counts, which makes the
 *    sidebar's "top 20" ordering meaningless and hides bugs in the facet
 *    counting. Skewed weights make the counts tell a story.
 *
 * 3. **The pools are small enough to repeat.** ~120 name combinations per
 *    nationality against ~50 users each means duplicate full names do occur.
 *    That is intentional: duplicates are what actually exercise the mandatory
 *    `id` tie-breaker in sorting and prove pagination is stable.
 */

import type { Weighted } from './random';

export interface NationalityProfile {
  /** Stored verbatim in `users.nationality`. */
  name: string;
  /** Relative likelihood of a user having this nationality. */
  weight: number;
  firstNames: readonly string[];
  lastNames: readonly string[];
}

/**
 * Weighting reflects a Gulf-headquartered organisation: a large South Asian and
 * Levantine workforce, a smaller European and East Asian presence. 24 entries
 * so that the sidebar's top-20 cut is actually exercised.
 */
// The name pools are laid out as readable rows on purpose; letting Prettier put
// one string per line turns this table into ~800 lines of noise.
// prettier-ignore
export const NATIONALITIES: readonly NationalityProfile[] = [
  {
    name: 'India',
    weight: 16,
    firstNames: [
      'Arjun', 'Rahul', 'Vikram', 'Aditya', 'Rohan', 'Karthik',
      'Priya', 'Ananya', 'Meera', 'Divya', 'Sneha', 'Kavya',
    ],
    lastNames: [
      'Sharma', 'Patel', 'Reddy', 'Iyer', 'Nair',
      'Gupta', 'Menon', 'Chatterjee', 'Desai', 'Rao',
    ],
  },
  {
    name: 'United Arab Emirates',
    weight: 12,
    firstNames: [
      'Ahmed', 'Mohammed', 'Khalid', 'Saeed', 'Rashid', 'Hamdan',
      'Fatima', 'Mariam', 'Noura', 'Shamma', 'Alia', 'Latifa',
    ],
    lastNames: [
      'Al Maktoum', 'Al Nahyan', 'Al Falasi', 'Al Suwaidi', 'Al Marri',
      'Al Mansoori', 'Al Zaabi', 'Al Ketbi', 'Al Shamsi', 'Al Hammadi',
    ],
  },
  {
    name: 'Philippines',
    weight: 10,
    firstNames: [
      'Jose', 'Mark', 'Angelo', 'Rodel', 'Christian', 'Nino',
      'Maria', 'Andrea', 'Kristine', 'Jasmine', 'Rowena', 'Aileen',
    ],
    lastNames: [
      'Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia',
      'Mendoza', 'Villanueva', 'Ramos', 'Dela Cruz', 'Aquino',
    ],
  },
  {
    name: 'Pakistan',
    weight: 9,
    firstNames: [
      'Bilal', 'Usman', 'Hassan', 'Imran', 'Faisal', 'Zain',
      'Ayesha', 'Hina', 'Sana', 'Maryam', 'Zara', 'Amna',
    ],
    lastNames: [
      'Khan', 'Malik', 'Chaudhry', 'Siddiqui', 'Qureshi',
      'Butt', 'Farooq', 'Raza', 'Shah', 'Iqbal',
    ],
  },
  {
    name: 'Egypt',
    weight: 8,
    firstNames: [
      'Omar', 'Youssef', 'Mostafa', 'Karim', 'Tarek', 'Amr',
      'Nour', 'Salma', 'Yasmin', 'Heba', 'Rania', 'Dina',
    ],
    lastNames: [
      'Hassan', 'Ibrahim', 'Mahmoud', 'El Sayed', 'Fahmy',
      'Abdelrahman', 'Shaker', 'Zaki', 'Gaber', 'Nasser',
    ],
  },
  {
    name: 'United Kingdom',
    weight: 6,
    firstNames: [
      'Oliver', 'Harry', 'Jack', 'George', 'Thomas', 'Daniel',
      'Emily', 'Sophie', 'Charlotte', 'Amelia', 'Grace', 'Isla',
    ],
    lastNames: [
      'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson',
      'Evans', 'Roberts', 'Walker', 'Hughes', 'Baker',
    ],
  },
  {
    name: 'Bangladesh',
    weight: 6,
    firstNames: [
      'Rakib', 'Tanvir', 'Shakib', 'Nayeem', 'Sajid', 'Arif',
      'Nusrat', 'Tasnim', 'Sadia', 'Farhana', 'Mim', 'Rumana',
    ],
    lastNames: [
      'Rahman', 'Hossain', 'Islam', 'Ahmed', 'Chowdhury',
      'Karim', 'Uddin', 'Alam', 'Sarker', 'Bhuiyan',
    ],
  },
  {
    name: 'United States',
    weight: 5,
    firstNames: [
      'James', 'Michael', 'Ethan', 'Noah', 'Tyler', 'Brandon',
      'Emma', 'Olivia', 'Ava', 'Madison', 'Hannah', 'Chloe',
    ],
    lastNames: [
      'Johnson', 'Williams', 'Miller', 'Davis', 'Anderson',
      'Martinez', 'Clark', 'Lewis', 'Harris', 'Young',
    ],
  },
  {
    name: 'Saudi Arabia',
    weight: 5,
    firstNames: [
      'Abdullah', 'Faisal', 'Turki', 'Nawaf', 'Sultan', 'Majed',
      'Reem', 'Sara', 'Haya', 'Lujain', 'Amal', 'Rawan',
    ],
    lastNames: [
      'Al Otaibi', 'Al Harbi', 'Al Qahtani', 'Al Ghamdi', 'Al Dossary',
      'Al Shehri', 'Al Zahrani', 'Al Mutairi', 'Al Anazi', 'Al Subaie',
    ],
  },
  {
    name: 'Lebanon',
    weight: 4,
    firstNames: [
      'Elie', 'Georges', 'Rami', 'Fadi', 'Nadim', 'Charbel',
      'Rita', 'Nadine', 'Carla', 'Joelle', 'Maya', 'Lara',
    ],
    lastNames: [
      'Haddad', 'Khoury', 'Nassar', 'Aoun', 'Gemayel',
      'Sleiman', 'Rizk', 'Saab', 'Chidiac', 'Karam',
    ],
  },
  {
    name: 'Jordan',
    weight: 4,
    firstNames: [
      'Laith', 'Zaid', 'Anas', 'Odai', 'Hamza', 'Mutaz',
      'Rand', 'Dana', 'Farah', 'Tala', 'Lina', 'Aya',
    ],
    lastNames: [
      'Al Masri', 'Odeh', 'Haddadin', 'Al Zoubi', 'Abu Jaber',
      'Al Tamimi', 'Sharaf', 'Barghouti', 'Al Khalidi', 'Dabbas',
    ],
  },
  {
    name: 'Syria',
    weight: 3,
    firstNames: [
      'Bassel', 'Wael', 'Ghaith', 'Samer', 'Firas', 'Adnan',
      'Rasha', 'Lama', 'Hala', 'Rima', 'Nisrine', 'Kinda',
    ],
    lastNames: [
      'Hariri', 'Attar', 'Sabbagh', 'Kanaan', 'Homsi',
      'Daoud', 'Shaaban', 'Barakat', 'Kassab', 'Halabi',
    ],
  },
  {
    name: 'Sri Lanka',
    weight: 3,
    firstNames: [
      'Dinesh', 'Kasun', 'Nuwan', 'Sanjeewa', 'Chamara', 'Ruwan',
      'Nimali', 'Sachini', 'Ishara', 'Tharushi', 'Dilini', 'Amaya',
    ],
    lastNames: [
      'Perera', 'Fernando', 'Silva', 'Jayasuriya', 'Wickramasinghe',
      'Bandara', 'Rajapaksa', 'Gunawardena', 'Herath', 'Dissanayake',
    ],
  },
  {
    name: 'Nepal',
    weight: 3,
    firstNames: [
      'Bikash', 'Suman', 'Prakash', 'Nabin', 'Anil', 'Sagar',
      'Sabina', 'Anjali', 'Puja', 'Sunita', 'Rojina', 'Manisha',
    ],
    lastNames: [
      'Shrestha', 'Thapa', 'Gurung', 'Tamang', 'Adhikari',
      'Bhattarai', 'Karki', 'Magar', 'Rai', 'Poudel',
    ],
  },
  {
    name: 'Nigeria',
    weight: 3,
    firstNames: [
      'Chinedu', 'Emeka', 'Tunde', 'Ifeanyi', 'Segun', 'Uche',
      'Ngozi', 'Chiamaka', 'Folake', 'Amara', 'Yemisi', 'Zainab',
    ],
    lastNames: [
      'Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Okonkwo',
      'Afolabi', 'Nwosu', 'Obi', 'Adebayo', 'Olawale',
    ],
  },
  {
    name: 'Kenya',
    weight: 2,
    firstNames: [
      'Brian', 'Kevin', 'Otieno', 'Mwangi', 'Dennis', 'Collins',
      'Wanjiku', 'Achieng', 'Njeri', 'Amina', 'Faith', 'Mercy',
    ],
    lastNames: [
      'Kamau', 'Ochieng', 'Mutua', 'Kiprop', 'Wanjala',
      'Njoroge', 'Omondi', 'Kimani', 'Barasa', 'Chebet',
    ],
  },
  {
    name: 'South Africa',
    weight: 2,
    firstNames: [
      'Sipho', 'Thabo', 'Johan', 'Pieter', 'Andile', 'Riaan',
      'Lerato', 'Zanele', 'Anika', 'Nomsa', 'Chantelle', 'Thandi',
    ],
    lastNames: [
      'Van der Merwe', 'Botha', 'Dlamini', 'Nkosi', 'Mokoena',
      'Pretorius', 'Naidoo', 'Khumalo', 'Van Wyk', 'Mahlangu',
    ],
  },
  {
    name: 'France',
    weight: 2,
    firstNames: [
      'Lucas', 'Hugo', 'Theo', 'Antoine', 'Julien', 'Mathieu',
      'Camille', 'Manon', 'Chloe', 'Lea', 'Juliette', 'Amelie',
    ],
    lastNames: [
      'Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent',
      'Lefebvre', 'Girard', 'Fontaine', 'Rousseau', 'Mercier',
    ],
  },
  {
    name: 'Germany',
    weight: 2,
    firstNames: [
      'Lukas', 'Jonas', 'Felix', 'Maximilian', 'Tobias', 'Sebastian',
      'Hannah', 'Lena', 'Marie', 'Johanna', 'Katharina', 'Sophia',
    ],
    lastNames: [
      'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber',
      'Wagner', 'Becker', 'Hoffmann', 'Schaefer', 'Koch',
    ],
  },
  {
    name: 'Spain',
    weight: 2,
    firstNames: [
      'Javier', 'Alejandro', 'Sergio', 'Pablo', 'Diego', 'Alvaro',
      'Lucia', 'Carmen', 'Elena', 'Marta', 'Paula', 'Irene',
    ],
    lastNames: [
      'Garcia', 'Rodriguez', 'Fernandez', 'Lopez', 'Martinez',
      'Sanchez', 'Gomez', 'Navarro', 'Torres', 'Ramirez',
    ],
  },
  {
    name: 'Italy',
    weight: 2,
    firstNames: [
      'Marco', 'Luca', 'Matteo', 'Andrea', 'Giuseppe', 'Francesco',
      'Giulia', 'Chiara', 'Francesca', 'Alessia', 'Martina', 'Sara',
    ],
    lastNames: [
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi',
      'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
    ],
  },
  {
    name: 'Russia',
    weight: 2,
    firstNames: [
      'Dmitri', 'Ivan', 'Sergei', 'Alexei', 'Nikolai', 'Andrei',
      'Anastasia', 'Ekaterina', 'Olga', 'Svetlana', 'Irina', 'Natalia',
    ],
    lastNames: [
      'Ivanov', 'Petrov', 'Smirnov', 'Kuznetsov', 'Popov',
      'Sokolov', 'Volkov', 'Novikov', 'Morozov', 'Lebedev',
    ],
  },
  {
    name: 'China',
    weight: 2,
    firstNames: [
      'Wei', 'Jian', 'Hao', 'Feng', 'Ming', 'Lei',
      'Xiaoli', 'Yan', 'Mei', 'Jing', 'Fang', 'Ling',
    ],
    lastNames: [
      'Wang', 'Li', 'Zhang', 'Liu', 'Chen',
      'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
    ],
  },
  {
    name: 'Japan',
    weight: 1,
    firstNames: [
      'Haruto', 'Sota', 'Yuto', 'Ren', 'Kenji', 'Takuya',
      'Sakura', 'Yui', 'Aoi', 'Hina', 'Rin', 'Mio',
    ],
    lastNames: [
      'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe',
      'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
    ],
  },
];

/**
 * Hobby catalogue. 44 entries against a top-20 sidebar, with weights spanning
 * 30:1, so the ordering is stable and obviously non-arbitrary — "Reading" should
 * top the list, "Falconry" should never come near it.
 */
export const HOBBIES: readonly Weighted<string>[] = [
  { value: 'Reading', weight: 30 },
  { value: 'Traveling', weight: 28 },
  { value: 'Cooking', weight: 26 },
  { value: 'Photography', weight: 22 },
  { value: 'Football', weight: 22 },
  { value: 'Music', weight: 20 },
  { value: 'Gaming', weight: 20 },
  { value: 'Hiking', weight: 18 },
  { value: 'Swimming', weight: 18 },
  { value: 'Running', weight: 16 },
  { value: 'Cycling', weight: 15 },
  { value: 'Fitness', weight: 14 },
  { value: 'Painting', weight: 12 },
  { value: 'Gardening', weight: 12 },
  { value: 'Yoga', weight: 12 },
  { value: 'Cricket', weight: 10 },
  { value: 'Chess', weight: 10 },
  { value: 'Dancing', weight: 10 },
  { value: 'Writing', weight: 9 },
  { value: 'Tennis', weight: 9 },
  { value: 'Basketball', weight: 9 },
  { value: 'Fishing', weight: 8 },
  { value: 'Camping', weight: 8 },
  { value: 'Baking', weight: 8 },
  { value: 'Board Games', weight: 7 },
  { value: 'Language Learning', weight: 7 },
  { value: 'Martial Arts', weight: 7 },
  { value: 'Volleyball', weight: 6 },
  { value: 'Volunteering', weight: 6 },
  { value: 'Podcasting', weight: 5 },
  { value: 'Woodworking', weight: 5 },
  { value: 'Rock Climbing', weight: 5 },
  { value: 'Astronomy', weight: 4 },
  { value: 'Calligraphy', weight: 4 },
  { value: 'Pottery', weight: 4 },
  { value: 'Scuba Diving', weight: 4 },
  { value: 'Archery', weight: 3 },
  { value: 'Kayaking', weight: 3 },
  { value: 'Knitting', weight: 3 },
  { value: 'Skiing', weight: 3 },
  { value: 'Surfing', weight: 3 },
  { value: 'Birdwatching', weight: 2 },
  { value: 'Origami', weight: 2 },
  { value: 'Falconry', weight: 1 },
];

/**
 * How many hobbies a user has. The spec allows 0-10; a flat distribution over
 * that range would be unrealistic and would also make every user's card show
 * the "+n" overflow badge. This curve peaks at 3 and keeps both edges
 * populated, so the UI has to handle "no hobbies" and "ten hobbies" for real.
 */
export const HOBBY_COUNT_DISTRIBUTION: readonly Weighted<number>[] = [
  { value: 0, weight: 4 },
  { value: 1, weight: 9 },
  { value: 2, weight: 15 },
  { value: 3, weight: 18 },
  { value: 4, weight: 16 },
  { value: 5, weight: 13 },
  { value: 6, weight: 9 },
  { value: 7, weight: 6 },
  { value: 8, weight: 4 },
  { value: 9, weight: 3 },
  { value: 10, weight: 3 },
];

/** Working-age distribution, skewed toward the 25-44 band. */
export const AGE_BANDS: readonly Weighted<readonly [min: number, max: number]>[] = [
  { value: [18, 24], weight: 12 },
  { value: [25, 34], weight: 34 },
  { value: [35, 44], weight: 28 },
  { value: [45, 54], weight: 16 },
  { value: [55, 64], weight: 8 },
  { value: [65, 70], weight: 2 },
];

/**
 * Avatars are generated by DiceBear from a stable per-user seed, so the same
 * row always renders the same face and the database stays small (a URL, not a
 * blob).
 *
 * Trade-off: this is an external host, so avatars will not render offline. The
 * card component is expected to fall back to initials on image error — which it
 * needs anyway for a broken URL.
 */
export const AVATAR_BASE_URL = 'https://api.dicebear.com/9.x/avataaars/svg';
