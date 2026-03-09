import WBK from "wikibase-sdk";
import type { Person, Image } from "./types";
import { Cookie, CookieMap } from "bun";
import { writeFileSync } from "fs";

const user_agent =
	"wiki-celebrity-scraper/0.0.0 (rinaldochenglee@gmail.com) bun/1.3.5";

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrape_wikidata(): Promise<Person[]> {
	const wdk = WBK({
		instance: "https://www.wikidata.org",
		sparqlEndpoint: "https://query.wikidata.org/sparql",
	});

	const url = wdk.sparqlQuery(`
SELECT DISTINCT ?item ?itemLabel ?genderLabel ?birthdate ?image WHERE {
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,mul". }
  {
    SELECT DISTINCT ?item ?itemLabel ?gender ?birthdate ?image WHERE {
      
      {
        ?item p:P27 ?statement0. 				  # P27: country of citizenship
        ?statement0 (ps:P27/(wdt:P279*)) wd:Q928. # Q928: Philippines
      }
      UNION
      {
        ?item p:P172 ?statement1. 					   # P172: ethnic group
        ?statement1 (ps:P172/(wdt:P279*)) wd:Q1262011. # Q1262011: tagalog people
      }
      UNION
      {
        ?item p:P172 ?statement2. 					   # P172: ethnic group
        ?statement2 (ps:P172/(wdt:P279*)) wd:Q4172847. # Q4172847: Filipinos
      }
      UNION
      {
        ?item p:P495 ?statement3. 				   # P495: ethnic group
        ?statement3 (ps:P495/(wdt:P279*)) wd:Q928. # Q928: Philippines
      }
	  UNION
      {
        ?item p:P27 ?statement4. 				  # P27: ethnic group
        ?statement4 (ps:P27/(wdt:P279*)) wd:Q833. # Q833: Malaysia
      }
      UNION
      {
        ?item p:P27 ?statement5. 				  # P27: ethnic group
        ?statement5 (ps:P27/(wdt:P279*)) wd:Q252. # Q252: Indonesia
      }
      UNION
      {
        ?item p:P172 ?statement1. 					   # P172: ethnic group
        ?statement1 (ps:P172/(wdt:P279*)) wd:Q142702.  # Q142702: malays
      }
      UNION
      {
        ?item p:P172 ?statement2. 					   # P172: ethnic group
        ?statement2 (ps:P172/(wdt:P279*)) wd:Q4200853. # Q4200853: indonesians
      }

      ?item wdt:P18 ?image .
	  
	  OPTIONAL {
      	?item wdt:P21 ?gender .
	  }

	  OPTIONAL {
		?item wdt:P569 ?birthdate .
	  }
	  
	  OPTIONAL {
	  	?item wdt:P27 ?country .
	  }
	  
	  OPTIONAL {
	  	?item wdt:P495 ?countryOfOrigin . 
	  }
    }
  }
}`);

	const response = await fetch(url, {
		headers: {
			"user-agent": user_agent,
		},
	});

	const retval: Person[] = [];

	const payload = await response.json();
	for (const binding of payload.results.bindings) {
		const person = {} as Person;
		person.wiki_url = binding.item.value;
		person.name = binding.itemLabel.value;
		person.gender = binding.genderLabel?.value;
		person.citizenship = binding.countryLabel?.value;
		person.countryOfOrigin = binding.countryOfOriginLabel?.value;
		person.birthdate = binding.birthdate?.value
			? new Date(binding.birthdate.value)
			: undefined;

		const item = person.wiki_url.split("/").pop()!;
		person.images = [
			{ url: binding.image.value },
			...(await scrape_images_from_item(item)),
		];
		retval.push(person);
		if (retval.length % 100 == 0) {
			writeFileSync(`people_${retval}.json`, JSON.stringify(retval, null, 2));
		}
		await sleep(500);
	}
	return retval;
}

async function scrape_images_from_item(item: string): Promise<Image[]> {
	const sparqlEndpoint = "https://qlever.dev/api/wikimedia-commons";

	const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>

SELECT ?file ?image WHERE {
  ?file wdt:P180 wd:${item}.
  ?file schema:url ?image.
}`;

	if (!Bun.env.WIKIMEDIA_COOKIE) {
		throw Error("No WIKIMEDIA_COOKIE set!");
	}

	console.log("connecting to commons");

	const jar = new CookieMap();
	jar.set("wcqsOauth", Bun.env.WIKIMEDIA_COOKIE);

	const response = await fetch(sparqlEndpoint, {
		method: "POST",
		body: query,
		headers: {
			accept: "application/json",
			"content-type": "application/sparql-query",
			"user-agent": user_agent,
			cookie: jar.toSetCookieHeaders(),
		},
		verbose: true,
	});

	const payload = await response.json();
	// console.log(JSON.stringify(payload, null, 2))

	return payload.results.bindings.map((binding: any) => ({
		url: binding.image.value,
		caption: binding.file.value,
	}));
}
