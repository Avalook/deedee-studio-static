const countrySource = `
Ả-rập Xê-út	+966
Afghanistan	+93
Ai Cập	+20
Albania	+355
Algeria	+213
Andorra	+376
Angola	+244
Anguilla	+1
Antigua và Barbuda	+1
Áo	+43
Argentina	+54
Armenia	+374
Aruba	+297
Azerbaijan	+994
Ấn Độ	+91
Ba Lan	+48
Bahamas	+1
Bahrain	+973
Bangladesh	+880
Barbados	+1246
Belarus	+375
Belize	+501
Benin	+229
Bermuda	+1
Bhutan	+975
Bỉ	+32
Bolivia	+591
Bonaire	+599
Bosnia và Herzegovina	+387
Botswana	+267
Bồ Đào Nha	+351
Brazil	+55
Brunei	+673
Bulgaria	+359
Burkina Faso	+226
Burundi	+257
Các Tiểu vương quốc Ả Rập Thống nhất	+971
Cameroon	+237
Campuchia	+855
Canada	+1
Cape Verde	+238
Chad	+235
Chile	+56
Colombia	+57
Comoros	+269
Congo (Brazzaville)	+242
Congo (Kinshasa)	+243
Costa Rica	+506
Cộng hòa Cốt-đi-voa	+225
Cộng hòa Dominica	+1
Cộng hòa Kosovo	+383
Cộng hòa Séc	+420
Cộng hòa Trung Phi	+236
Croatia	+385
Curaçao	+599
Djibouti	+253
Dominica	+1
Đài Loan	+886
Đan Mạch	+45
Đảo Giáng Sinh	+61
Đảo Man	+44
Đảo Norfolk	+672
Đông Timor	+670
Đức	+49
Ecuador	+593
El Salvador	+503
Eritrea	+291
Estonia	+372
Eswatini	+268
Ethiopia	+251
Fiji	+679
Gabon	+241
Gambia	+220
Georgia	+995
Ghana	+233
Gibraltar	+350
Greenland	+299
Grenada	+1
Guadeloupe	+590
Guam	+1
Guatemala	+502
Guernsey	+44
Guiana thuộc Pháp	+594
Guinea	+224
Guinea Xích đạo	+240
Guinea-Bissau	+245
Guyana	+592
Hà Lan	+31
Haiti	+509
Hàn Quốc	+82
Hoa Kỳ	+1
Honduras	+504
Hồng Kông	+852
Hungary	+36
Hy Lạp	+30
Iceland	+354
Indonesia	+62
Iraq	+964
Ireland	+353
Israel	+972
Jamaica	+1876
Jersey	+44
Jordan	+962
Kazakhstan	+7
Kenya	+254
Kiribati	+686
Kuwait	+965
Kyrgyzstan	+996
Lãnh thổ Ấn Độ Dương thuộc Anh	+246
Lãnh thổ của người Palestine	+970
Lào	+856
Latvia	+371
Lebanon	+961
Lesotho	+266
Liberia	+231
Libya	+218
Liechtenstein	+423
Litva	+370
Luxembourg	+352
Ma Cao	+853
Ma-rốc	+212
Macedonia	+389
Madagascar	+261
Malawi	+265
Malaysia	+60
Maldives	+960
Mali	+223
Malta	+356
Martinique	+596
Mauritania	+222
Mauritius	+230
Mayotte	+262
Mexico	+52
Micronesia	+691
Moldova	+373
Monaco	+377
Montenegro	+382
Montserrat	+1
Mozambique	+258
Mông Cổ	+976
Myanmar	+95
Na Uy	+47
Nam Phi	+27
Nam Sudan	+211
Namibia	+264
Nauru	+674
Nepal	+977
New Caledonia	+687
New Zealand	+64
Nga	+7
Nhật Bản	+81
Nicaragua	+505
Niger	+227
Nigeria	+234
Niue	+683
Oman	+968
Pakistan	+92
Palau	+680
Panama	+507
Papua New Guinea	+675
Paraguay	+595
Peru	+51
Pháp	+33
Phần Lan	+358
Philippines	+63
Polynesia thuộc Pháp	+689
Puerto Rico	+1
Qatar	+974
Quần đảo Aland	+358
Quần đảo Bắc Mariana	+1670
Quần đảo Cayman	+1
Quần đảo Cocos (Keeling)	+61
Quần đảo Cook	+682
Quần đảo Falkland	+500
Quần đảo Faroe	+298
Quần đảo Marshall	+692
Quần đảo Solomon	+677
Quần đảo Turks và Caicos	+1
Quần đảo Virgin thuộc Anh	+1
Quần đảo Virgin thuộc Mỹ	+1
Reunion	+262
Rumani	+40
Rwanda	+250
Saint Barthélemy	+590
Saint Helena	+290
Saint Kitts và Nevis	+1
Saint Lucia	+1
Saint Martin	+590
Saint Pierre và Miquelon	+508
Saint Vincent và Grenadines	+1
Samoa	+685
Samoa thuộc Hoa Kỳ	+1684
San Marino	+378
Sao Tome và Principe	+239
Senegal	+221
Serbia	+381
Seychelles	+248
Sierra Leone	+232
Singapore	+65
Sint Maarten	+1721
Síp	+357
Slovakia	+421
Slovenia	+386
Somalia	+252
Sri Lanka	+94
Sudan	+249
Suriname	+597
Svalbard và Jan Mayen	+47
Tajikistan	+992
Tanzania	+255
Tây Ban Nha	+34
Thái Lan	+66
Thổ Nhĩ Kỳ	+90
Thụy Điển	+46
Thụy Sĩ	+41
Togo	+228
Tokelau	+690
Tonga	+676
Trinidad và Tobago	+1868
Trung Quốc	+86
Tunisia	+216
Turkmenistan	+993
Tuvalu	+688
Úc	+61
Uganda	+256
Ukraina	+380
Uruguay	+598
Uzbekistan	+998
Vanuatu	+678
Vatican	+39
Venezuela	+58
Việt Nam	+84
Vương quốc Anh	+44
Wallis và Futuna	+681
Ý	+39
Yemen	+967
Zambia	+260
Zimbabwe	+263
`;

const countryFlagCodes = `
  SAU AFG EGY ALB DZA AND AGO AIA ATG AUT ARG ARM ABW AZE IND POL
  BHS BHR BGD BRB BLR BLZ BEN BMU BTN BEL BOL BES BIH BWA PRT BRA
  BRN BGR BFA BDI ARE CMR KHM CAN CPV TCD CHL COL COM COG COD CRI
  CIV DOM KOS CZE CAF HRV CUW DJI DMA TWN DNK CXR IMN NFK TLS DEU
  ECU SLV ERI EST SWZ ETH FJI GAB GMB GEO GHA GIB GRL GRD GLP GUM
  GTM GGY GUF GIN GNQ GNB GUY NLD HTI KOR USA HND HKG HUN GRC ISL
  IDN IRQ IRL ISR JAM JEY JOR KAZ KEN KIR KWT KGZ IOT PSE LAO LVA
  LBN LSO LBR LBY LIE LTU LUX MAC MAR MKD MDG MWI MYS MDV MLI MLT
  MTQ MRT MUS MYT MEX FSM MDA MCO MNE MSR MOZ MNG MMR NOR ZAF SSD
  NAM NRU NPL NCL NZL RUS JPN NIC NER NGA NIU OMN PAK PLW PAN PNG
  PRY PER FRA FIN PHL PYF PRI QAT ALA MNP CYM CCK COK FLK FRO MHL
  SLB TCA VGB VIR REU ROU RWA BLM SHN KNA LCA MAF SPM VCT WSM ASM
  SMR STP SEN SRB SYC SLE SGP SXM CYP SVK SVN SOM LKA SDN SUR SJM
  TJK TZA ESP THA TUR SWE CHE TGO TKL TON TTO CHN TUN TKM TUV DEU
  UGA UKR URY UZB VUT VAT VEN VNM GBR WLF ITA YEM ZMB ZWE
`.trim().split(/\s+/);

export const PHONE_COUNTRIES = Object.freeze(countrySource.trim().split('\n').map((line, index) => {
  const [name, code] = line.split('\t');
  return Object.freeze({ name, code, flag: countryFlagCodes[index] });
}));

export function findPhoneCountry(name, code, countries = PHONE_COUNTRIES) {
  return countries.find(country => country.name === name && country.code === code) || null;
}

export function normalizeCountrySearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').trim();
}

export function searchPhoneCountries(query, countries = PHONE_COUNTRIES) {
  const normalized = normalizeCountrySearch(query);
  if (!normalized) return [...countries];
  return countries.filter(({ name, code }) =>
    normalizeCountrySearch(`${name} ${code}`).includes(normalized),
  );
}

export function phoneCountrySelection(country) {
  if (!country || typeof country.name !== 'string' || typeof country.code !== 'string') return null;
  const name = country.name.trim();
  const code = country.code.trim();
  const flag = typeof country.flag === 'string' && /^[A-Z]{3}$/.test(country.flag) ? country.flag : '';
  if (!name || !/^\+\d{1,4}$/.test(code)) return null;
  return Object.freeze({ name, code, flag, display: code, label: `${name} ${code}` });
}
