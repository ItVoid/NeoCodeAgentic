import { StringArray } from "@shared/proto/cline/common"
import { OpenAiModelsRequest } from "@shared/proto/cline/models"
import type { AxiosRequestConfig } from "axios"
import axios from "axios"
import { getAxiosSettings } from "@/shared/net"
import { Controller } from ".."

/**
 * Fetches available models from the OpenAI API
 * @param controller The controller instance
 * @param request Request containing the base URL and API key
 * @returns Array of model names
 */
export async function refreshOpenAiModels(_controller: Controller, request: OpenAiModelsRequest): Promise<StringArray> {
	try {
		if (!request.baseUrl) {
			throw new Error("Base URL is required")
		}

		if (!URL.canParse(request.baseUrl)) {
			throw new Error("Invalid Base URL format")
		}

		const config: AxiosRequestConfig = {}
		if (request.apiKey) {
			config["headers"] = { Authorization: `Bearer ${request.apiKey}` }
		}

		const response = await axios.get(`${request.baseUrl}/models`, { ...config, ...getAxiosSettings() })
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		const models = [...new Set<string>(modelsArray)]

		return StringArray.create({ values: models })
	} catch (error) {
		console.error("Error fetching OpenAI models:", error)
		// Re-throw the error so it reaches the webview
		if (error instanceof Error) {
			throw error
		}
		throw new Error("Failed to fetch models. Please check your Base URL and API Key.")
	}
}
