/** Delhi NCR service-list pin centroids. Keep in sync with backend/src/utils/pincodeCoords.js */
const PINCODE_COORDS = {
  // Delhi
  "110001": { lat: 28.63, long: 77.217 }, // Connaught Place / New Delhi GPO
  "110002": { lat: 28.6453, long: 77.2456 }, // Darya Ganj / Civic Centre
  "110003": { lat: 28.596, long: 77.227 }, // Pandara Road / Lodhi Road
  "110004": { lat: 28.616, long: 77.2046 }, // Rashtrapati Bhawan
  "110005": { lat: 28.6536, long: 77.1918 }, // Karol Bagh / Anand Parbat
  "110006": { lat: 28.653, long: 77.231 }, // Chandni Chowk / Chawri Bazar
  "110007": { lat: 28.6764, long: 77.2074 }, // Kamla Nagar / Delhi University
  "110008": { lat: 28.6458, long: 77.1785 }, // Patel Nagar
  "110009": { lat: 28.7121, long: 77.206 }, // Model Town / Mukherjee Nagar
  "110010": { lat: 28.5983, long: 77.1235 }, // Delhi Cantt
  "110011": { lat: 28.6095, long: 77.2089 }, // Nirman Bhawan / South Avenue
  "110012": { lat: 28.6359, long: 77.1457 }, // Inderpuri / IARI
  "110013": { lat: 28.5878, long: 77.2541 }, // Hazrat Nizamuddin
  "110014": { lat: 28.581, long: 77.248 }, // Jangpura / Bhogal
  "110015": { lat: 28.6602, long: 77.1495 }, // Moti Nagar / Karampura / Zakhira
  "110016": { lat: 28.5531, long: 77.1916 }, // Hauz Khas / Green Park
  "110017": { lat: 28.533, long: 77.212 }, // Saket / Malviya Nagar
  "110018": { lat: 28.6396, long: 77.0884 }, // Tilak Nagar / Vikas Puri
  "110019": { lat: 28.5418, long: 77.2545 }, // Nehru Place / Kalkaji / CR Park
  "110020": { lat: 28.542, long: 77.273 }, // Okhla Industrial Area
  "110021": { lat: 28.5818, long: 77.1793 }, // Chanakyapuri / Moti Bagh
  "110022": { lat: 28.5734, long: 77.176 }, // R K Puram
  "110023": { lat: 28.5735, long: 77.2022 }, // Sarojini Nagar / Kidwai Nagar
  "110024": { lat: 28.5724, long: 77.2364 }, // Lajpat Nagar / Defence Colony
  "110025": { lat: 28.5672, long: 77.2725 }, // Jamia Nagar / Okhla
  "110026": { lat: 28.6709, long: 77.141 }, // Punjabi Bagh
  "110027": { lat: 28.6428, long: 77.1181 }, // Rajouri Garden / Subhash Nagar
  "110028": { lat: 28.6221, long: 77.1386 }, // Naraina
  "110029": { lat: 28.565, long: 77.1972 }, // Safdarjung Enclave / AIIMS
  "110030": { lat: 28.517, long: 77.185 }, // Mehrauli / Lado Sarai / Ghitorni
  "110031": { lat: 28.6548, long: 77.2751 }, // Gandhi Nagar / Geeta Colony
  "110032": { lat: 28.6754, long: 77.2946 }, // Shahdara
  "110033": { lat: 28.7274, long: 77.1698 }, // Jahangirpuri / Adarsh Nagar
  "110034": { lat: 28.686, long: 77.1325 }, // Pitampura / Rani Bagh
  "110035": { lat: 28.6772, long: 77.1573 }, // Inderlok / Keshav Puram
  "110036": { lat: 28.7978, long: 77.13 }, // Alipur
  "110037": { lat: 28.548, long: 77.1133 }, // IGI Airport / Mahipalpur
  "110038": { lat: 28.519, long: 77.0958 }, // Rajokri
  "110039": { lat: 28.805, long: 77.0309 }, // Bawana
  "110040": { lat: 28.8408, long: 77.0939 }, // Narela
  "110041": { lat: 28.6731, long: 77.0407 }, // Nangloi / Mundka
  "110042": { lat: 28.7441, long: 77.145 }, // Badli / Samaypur
  "110043": { lat: 28.6064, long: 76.9827 }, // Najafgarh
  "110044": { lat: 28.507, long: 77.299 }, // Badarpur / Jaitpur
  "110045": { lat: 28.6035, long: 77.0894 }, // Palam / Mahavir Enclave
  "110046": { lat: 28.6007, long: 77.1087 }, // Sagarpur / Nangal Raya
  "110047": { lat: 28.4581, long: 77.1382 }, // Aya Nagar / Arjangarh
  "110048": { lat: 28.547, long: 77.238 }, // Greater Kailash / Kailash Colony
  "110049": { lat: 28.5573, long: 77.2196 }, // South Extension / Shahpur Jat
  "110051": { lat: 28.656, long: 77.288 }, // Krishna Nagar / Azad Nagar
  "110052": { lat: 28.6799, long: 77.1767 }, // Ashok Vihar / Shastri Nagar
  "110053": { lat: 28.7008, long: 77.2667 }, // Bhajanpura / Yamuna Vihar
  "110054": { lat: 28.6921, long: 77.2245 }, // Civil Lines / Majnu ka Tila
  "110055": { lat: 28.6417, long: 77.2132 }, // Paharganj
  "110056": { lat: 28.6827, long: 77.115 }, // Shakur Basti
  "110057": { lat: 28.5684, long: 77.1596 }, // Vasant Vihar
  "110058": { lat: 28.6219, long: 77.0878 }, // Janakpuri
  "110059": { lat: 28.6172, long: 77.0598 }, // Uttam Nagar / Mohan Garden
  "110060": { lat: 28.6381, long: 77.1803 }, // Rajinder Nagar
  "110061": { lat: 28.5346, long: 77.0536 }, // Bijwasan
  "110062": { lat: 28.5081, long: 77.2294 }, // Deoli / Dakshinpuri
  "110063": { lat: 28.6696, long: 77.096 }, // Paschim Vihar
  "110064": { lat: 28.6296, long: 77.1119 }, // Hari Nagar
  "110065": { lat: 28.562, long: 77.2553 }, // East of Kailash / Srinivaspuri
  "110066": { lat: 28.5574, long: 77.1827 }, // R K Puram (Main)
  "110067": { lat: 28.5553, long: 77.1743 }, // JNU / Munirka
  "110068": { lat: 28.4985, long: 77.207 }, // IGNOU / Maidan Garhi
  "110070": { lat: 28.525, long: 77.155 }, // Vasant Kunj
  "110071": { lat: 28.5462, long: 76.9902 }, // Qutub Vihar / Badusarai / Goyla
  "110073": { lat: 28.57, long: 76.907 }, // Dhansa / Jafarpur / Ujwa
  "110074": { lat: 28.5033, long: 77.1788 }, // Chhatarpur / Fatehpur Beri
  "110075": { lat: 28.5876, long: 77.0571 }, // Dwarka Sector 6
  "110076": { lat: 28.525, long: 77.3062 }, // Sarita Vihar / Madanpur Khadar
  "110078": { lat: 28.6081, long: 77.0193 }, // Dwarka / Kakrola
  "110081": { lat: 28.7299, long: 76.9928 }, // Kanjhawala
  "110082": { lat: 28.7848, long: 77.1046 }, // Holambi Kalan / Khera Kalan
  "110083": { lat: 28.6927, long: 77.0937 }, // Mangolpuri
  "110084": { lat: 28.7486, long: 77.2096 }, // Burari / Jagatpur
  "110085": { lat: 28.7201, long: 77.1027 }, // Rohini (Sectors 5-11)
  "110086": { lat: 28.7158, long: 77.0743 }, // Sultanpuri / Pooth Kalan
  "110087": { lat: 28.6726, long: 77.0866 }, // Peeragarhi / Sunder Vihar
  "110088": { lat: 28.7219, long: 77.159 }, // Shalimar Bagh
  "110091": { lat: 28.6063, long: 77.3045 }, // Patparganj / Trilokpuri
  "110092": { lat: 28.6266, long: 77.2794 }, // Preet Vihar / Laxmi Nagar
  "110093": { lat: 28.6978, long: 77.3057 }, // Nand Nagri / Sunder Nagri
  "110094": { lat: 28.7173, long: 77.287 }, // Gokalpuri / Johripur
  "110095": { lat: 28.6823, long: 77.321 }, // Dilshad Garden / Jhilmil
  "110096": { lat: 28.6132, long: 77.3232 }, // Mayur Vihar Ph-3 / Vasundhara Enclave

  // Faridabad / Palwal / Nuh (Haryana)
  "121001": { lat: 28.395, long: 77.3 }, // Faridabad NIT / Industrial Area
  "121002": { lat: 28.41, long: 77.325 }, // Faridabad Sector 16 / 16A / 18
  "121004": { lat: 28.3434, long: 77.3229 }, // Ballabgarh / Sector 3
  "121005": { lat: 28.368, long: 77.29 }, // Faridabad Sector 22 / Jawahar Colony
  "121006": { lat: 28.3663, long: 77.3321 }, // Faridabad Sector 7-9 / GT Road
  "121007": { lat: 28.388, long: 77.324 }, // Faridabad Sector 12 / 15
  "121008": { lat: 28.434, long: 77.32 }, // Faridabad Sector 28-29
  "121009": { lat: 28.49, long: 77.295 }, // Surajkund / Faridabad Sector 21
  "121010": { lat: 28.474, long: 77.297 }, // NHPC Colony / Faridabad Sector 33
  "121011": { lat: 28.448, long: 77.3 }, // Gurukul Indraprastha
  "121101": { lat: 28.36, long: 77.415 }, // Tigaon / Greater Faridabad villages
  "121102": { lat: 28.145, long: 77.326 }, // Palwal
  "121103": { lat: 28.042, long: 77.216 }, // Hathin
  "121104": { lat: 27.8638, long: 77.2052 }, // Punhana
  "121105": { lat: 28.0107, long: 77.3423 }, // Aurangabad / Bamni Khera (Palwal)
  "121106": { lat: 27.895, long: 77.376 }, // Hodal
  "121107": { lat: 27.9789, long: 77.4924 }, // Hassanpur (Palwal)

  // Gurugram / Nuh / Rewari (Haryana)
  "122001": { lat: 28.465, long: 77.03 }, // Gurugram old city / Sector 12-17
  "122002": { lat: 28.483, long: 77.0921 }, // DLF Phase 1 / Chakkarpur / Sector 25-28
  "122003": { lat: 28.438, long: 77.07 }, // Sector 45-51
  "122006": { lat: 28.47, long: 76.995 }, // Railway Road / Basai / Daulatabad
  "122008": { lat: 28.488, long: 77.088 }, // DLF Phase 2
  "122009": { lat: 28.4673, long: 77.0818 }, // DLF Phase 4 / Galleria
  "122010": { lat: 28.4965, long: 77.0967 }, // DLF Phase 3 / Sector 24
  "122011": { lat: 28.427, long: 77.095 }, // Sector 56 / Golf Course Extension
  "122015": { lat: 28.495, long: 77.068 }, // Palam Road / Sarhaul / Sector 18
  "122016": { lat: 28.503, long: 77.08 }, // Udyog Vihar / Sector 19-20
  "122017": { lat: 28.508, long: 77.04 }, // Palam Vihar / Sector 1-3
  "122018": { lat: 28.418, long: 77.048 }, // South City 2 / Sector 49-50
  "122051": { lat: 28.357, long: 76.93 }, // IMT Manesar / Kasan
  "122101": { lat: 28.393, long: 77.045 }, // Badshahpur / Sector 65-70
  "122102": { lat: 28.355, long: 77.065 }, // Bhondsi / Ghamroj
  "122103": { lat: 28.2474, long: 77.0654 }, // Sohna
  "122104": { lat: 27.7882, long: 76.947 }, // Ferozepur Jhirka
  "122105": { lat: 28.2109, long: 76.9506 }, // Tauru
  "122106": { lat: 28.2055, long: 76.7953 }, // Dharuhera
  "122107": { lat: 28.103, long: 77.0048 }, // Nuh
  "122108": { lat: 27.918, long: 76.984 }, // Nagina
  "123003": { lat: 28.317, long: 76.812 }, // Uncha Majra / Narhera (Pataudi)
  "123413": { lat: 28.298, long: 76.864 }, // Bhora Kalan
  "123414": { lat: 28.2712, long: 76.7408 }, // Nanu Kalan
  "123502": { lat: 28.2753, long: 76.6784 }, // Khalilpur / Turkiawas
  "123504": { lat: 28.3512, long: 76.7564 }, // Haily Mandi
  "123505": { lat: 28.4383, long: 76.9307 }, // Garhi Harsaru / Wazirpur
  "123506": { lat: 28.448, long: 76.8229 }, // Farrukhnagar

  // Ghaziabad / Noida / Hapur (Uttar Pradesh)
  "201001": { lat: 28.665, long: 77.44 }, // Ghaziabad (Ashok Nagar / Nehru Nagar)
  "201003": { lat: 28.715, long: 77.42 }, // Meerut Road / Morta
  "201004": { lat: 28.695, long: 77.36 }, // Hindon Air Field
  "201005": { lat: 28.686, long: 77.362 }, // Sahibabad / Bhopura
  "201006": { lat: 28.685, long: 77.327 }, // Chikambarpur
  "201007": { lat: 28.678, long: 77.38 }, // Mohan Nagar
  "201009": { lat: 28.66, long: 77.432 }, // Ghaziabad City / Model Town
  "201010": { lat: 28.652, long: 77.35 }, // Bharat Nagar / Sahibabad Industrial Area
  "201011": { lat: 28.6649, long: 77.3303 }, // Chander Nagar
  "201012": { lat: 28.655, long: 77.355 }, // Kaushambi / Vasundhara
  "201013": { lat: 28.685, long: 77.485 }, // Govindpuram
  "201102": { lat: 28.75, long: 77.31 }, // Loni
  "201201": { lat: 28.859, long: 77.6257 }, // Govindpuri / Harmukhpuri (Modinagar)
  "201204": { lat: 28.8331, long: 77.57 }, // Modinagar
  "201206": { lat: 28.7734, long: 77.5034 }, // Muradnagar
  "201301": { lat: 28.5792, long: 77.3242 }, // Noida Sector 16 / 27
  "201302": { lat: 28.5787, long: 77.3134 }, // NDC Noida Sector 16
  "245101": { lat: 28.7306, long: 77.7759 }, // Hapur
  "245201": { lat: 28.7238, long: 77.8767 }, // Babugarh / Hapur east
  "245205": { lat: 28.7892, long: 78.0823 }, // Garhmukteshwar
  "245207": { lat: 28.762, long: 77.9856 }, // Simbhaoli
  "245208": { lat: 28.6605, long: 78.1536 }, // Bahadurgarh (Hapur)
  "245301": { lat: 28.6425, long: 77.6528 }, // Dhaulana
  "245304": { lat: 28.7128, long: 77.6566 }, // Pilkhuwa
};

function normalizePincode(pincode) {
  return String(pincode || "").replace(/\D/g, "").slice(0, 6);
}

export function getPincodeCoords(pincode) {
  const pin = normalizePincode(pincode);
  const entry = PINCODE_COORDS[pin];
  if (!entry) return null;
  const lat = Number(entry.lat);
  const long = Number(entry.long);
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
  return { lat, long };
}

/** Quick is available only when we have a pin centroid (client Delhi NCR service list). */
export function isPinQuickAvailable(pincode) {
  return !!getPincodeCoords(pincode);
}

export { PINCODE_COORDS };
