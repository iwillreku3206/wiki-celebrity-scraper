import WBK from "wikibase-sdk";
import type { Person } from "./types";
import { Cookie, CookieMap } from "bun";

const user_agent = "wiki-celebrity-scraper/0.0.0 (rinaldochenglee@gmail.com) bun/1.3.5"

export async function scrape_wikidata(): Promise<Person[]> {
	const wdk = WBK({
		instance: 'https://www.wikidata.org',
		sparqlEndpoint: 'https://query.wikidata.org/sparql'
	})

	const url = wdk.sparqlQuery(`
SELECT DISTINCT ?item ?itemLabel ?genderLabel ?birthdate ?image WHERE {
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en,mul". }
  {
    SELECT DISTINCT ?item ?itemLabel ?gender ?birthdate ?image WHERE {
      
      {
        ?item p:P27 ?statement0.
        ?statement0 (ps:P27/(wdt:P279*)) wd:Q928.
      }
      UNION
      {
        ?item p:P172 ?statement1.
        ?statement1 (ps:P172/(wdt:P279*)) wd:Q1262011.
      }
      UNION
      {
        ?item p:P172 ?statement2.
        ?statement2 (ps:P172/(wdt:P279*)) wd:Q4172847.
      }
      UNION
      {
        ?item p:P495 ?statement6.
        ?statement6 (ps:P495/(wdt:P279*)) wd:Q928.
      }

      ?item wdt:P18 ?image .

      OPTIONAL {
        ?item wdt:P21 ?gender .
      }
      
      OPTIONAL {
        ?item wdt:P569 ?birthdate .
      }
    }
  }
} LIMIT 1
									`)

	const response = await fetch(url, {
		headers: {
			'user-agent': user_agent
		}
	})

	const payload = await response.text()

	return []
}

async function scrape_images_from_item(item: string) {
	const sparqlEndpoint = 'https://qlever.dev/api/wikimedia-commons'

	const query = `
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX schema: <http://schema.org/>

SELECT ?file ?image WHERE {
  ?file wdt:P180 wd:${item}.
  ?file schema:url ?image.
}`

	if (!Bun.env.WIKIMEDIA_COOKIE) {
		throw Error("No WIKIMEDIA_COOKIE set!")
	}

	console.log('connecting to commons')

	const jar = new CookieMap()
	jar.set('wcqsOauth', Bun.env.WIKIMEDIA_COOKIE)

	const response = await fetch(sparqlEndpoint, {
		method: 'POST',
		body: query,
		headers: {
			'accept': 'application/json',
			'content-type': 'application/sparql-query',
			'user-agent': user_agent,
			'cookie': jar.toSetCookieHeaders()
		},
		verbose: true
	})

	const payload = JSON.stringify(await response.json(), null, 2)

	console.log(payload)

	return []
}
