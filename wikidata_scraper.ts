import WBK from "wikibase-sdk";
import type { Person, Image } from "./types";
import { CookieMap } from "bun";
import { writeFileSync } from "fs";

const user_agent = "wiki-celebrity-scraper/0.0.1 (rinaldochenglee@gmail.com) bun/1.3.5";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SEA_ENTITIES = [
	{ id: "wd:Q928", label: "Philippines" },
	{ id: "wd:Q252", label: "Indonesia" },
	{ id: "wd:Q833", label: "Malaysia" },
	{ id: "wd:Q869", label: "Thailand" },
	{ id: "wd:Q881", label: "Vietnam" },
	{ id: "wd:Q424", label: "Cambodia" },
	{ id: "wd:Q819", label: "Laos" },
	{ id: "wd:Q836", label: "Myanmar" },
	{ id: "wd:Q334", label: "Singapore" },
	{ id: "wd:Q921", label: "Brunei" },
	{ id: "wd:Q574", label: "Timor-Leste" }
];

export async function scrape_all_sea(): Promise<Person[]> {
	const wdk = WBK({
		instance: "https://www.wikidata.org",
		sparqlEndpoint: "https://query.wikidata.org/sparql",
	});

	let allResults: Person[] = [];

	for (const entity of SEA_ENTITIES) {
		let offset = 0;
		const limit = 200;
		let hasMore = true;

		while (hasMore) {
			const sparql = `
SELECT ?item ?itemLabel ?genderLabel ?birthdate ?image ?primaryTimestamp WHERE {
  {
    SELECT DISTINCT ?item ?gender ?birthdate ?image ?primaryTimestamp WHERE {
      ?item wdt:P31 wd:Q5.
      ?item wdt:P21 ?gender. 
      ?item (wdt:P27|wdt:P172|wdt:P495) ${entity.id}.
      
      # Primary Image + Timestamp logic in one block
      ?item wdt:P18 ?image.
      OPTIONAL {
        ?imageFile schema:about ?image.
        OPTIONAL { ?imageFile wdt:P571 ?inc. }
        OPTIONAL { ?imageFile wdt:P585 ?pit. }
        BIND(COALESCE(?inc, ?pit) AS ?primaryTimestamp)
      }
      OPTIONAL { ?item wdt:P569 ?birthdate. }
    }
    LIMIT ${limit}
    OFFSET ${offset}
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

			try {
				const url = wdk.sparqlQuery(sparql);
				const response = await fetch(url, { headers: { "User-Agent": user_agent } });
				const data = await response.json();
				const bindings = data.results.bindings;

				if (bindings.length === 0) {
					hasMore = false;
					break;
				}

				for (const b of bindings) {
					const qid = b.item.value.split("/").pop()!;

					// const extraImages = await scrape_images_from_item(qid);

					allResults.push({
						wiki_url: b.item.value,
						name: b.itemLabel.value,
						gender: b.genderLabel.value,
						matched_demographic: entity.label,
						birthdate: b.birthdate?.value ? new Date(b.birthdate.value) : undefined,
						images: [
							{ url: b.image.value, timestamp: b.primaryTimestamp?.value || "Unknown" },
							// ...extraImages
						]
					});
				}

				console.log(`[${entity.label}] Offset ${offset} complete. Total: ${allResults.length}`);
				offset += limit;
				await sleep(500);
			} catch (e) {
				console.error("Query timed out or failed. Reducing offset and retrying...");
				await sleep(5000);
			}
		}
		writeFileSync(`sea_data_${entity.label.toLowerCase()}.json`, JSON.stringify(allResults, null, 2));
	}
	return allResults;
}

async function scrape_images_from_item(qid: string): Promise<Image[]> {
	const sparqlEndpoint = "https://qlever.dev/api/wikimedia-commons";
	const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?image ?timestamp WHERE {
  ?file wdt:P180 wd:${qid}.
  ?file schema:url ?image.
  OPTIONAL { ?file wdt:P571 ?i. }
  OPTIONAL { ?file wdt:P585 ?p. }
  BIND(COALESCE(?i, ?p) AS ?timestamp)
} LIMIT 5`;

	if (!Bun.env.WIKIMEDIA_COOKIE) return [];
	const jar = new CookieMap();
	jar.set("wcqsOauth", Bun.env.WIKIMEDIA_COOKIE);

	try {
		const res = await fetch(sparqlEndpoint, {
			method: "POST",
			body: query,
			headers: { "Content-Type": "application/sparql-query", "Cookie": jar.toSetCookieHeaders() }
		});
		const data = await res.json();
		return data.results.bindings.map((b: any) => ({
			url: b.image.value,
			timestamp: b.timestamp?.value || "Unknown"
		}));
	} catch { return []; }
}