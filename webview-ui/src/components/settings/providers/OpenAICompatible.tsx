import { TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip"
import { OpenAiModelsRequest } from "@shared/proto/cline/models"
import { Mode } from "@shared/storage/types"
import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Tooltip } from "@/components/ui/tooltip"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ModelsServiceClient } from "@/services/grpc-client"
import { ApiKeyField } from "../common/ApiKeyField"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { getModeSpecificFields, normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

/**
 * Props for the OpenAICompatibleProvider component
 */
interface OpenAICompatibleProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * The OpenAI Compatible provider configuration component
 */
export const OpenAICompatibleProvider = ({ showModelOptions, isPopup, currentMode }: OpenAICompatibleProviderProps) => {
	const { apiConfiguration, remoteConfigSettings } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange } = useApiConfigurationHandlers()

	const [modelConfigurationSelected, setModelConfigurationSelected] = useState(false)
	const [availableModels, setAvailableModels] = useState<string[]>([])
	const [isLoadingModels, setIsLoadingModels] = useState(false)
	const [modelError, setModelError] = useState<string | null>(null)

	// Get the normalized configuration
	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	// Get mode-specific fields
	const { openAiModelInfo } = getModeSpecificFields(apiConfiguration, currentMode)

	// Debounced function to refresh OpenAI models (prevents excessive API calls while typing)
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [])

	// Fetch models on mount if baseUrl and apiKey are already configured
	useEffect(() => {
		if (apiConfiguration?.openAiBaseUrl && apiConfiguration?.openAiApiKey) {
			debouncedRefreshOpenAiModels(apiConfiguration.openAiBaseUrl, apiConfiguration.openAiApiKey)
		}
	}, []) // Only run on mount

	const debouncedRefreshOpenAiModels = useCallback((baseUrl?: string, apiKey?: string) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		if (baseUrl && apiKey) {
			setIsLoadingModels(true)
			setModelError(null)
			debounceTimerRef.current = setTimeout(() => {
				ModelsServiceClient.refreshOpenAiModels(
					OpenAiModelsRequest.create({
						baseUrl,
						apiKey,
					}),
				)
					.then((response) => {
						setAvailableModels(response.values || [])
						setIsLoadingModels(false)
						setModelError(null)
					})
					.catch((error) => {
						console.error("Failed to refresh OpenAI models:", error)
						setAvailableModels([])
						setIsLoadingModels(false)

						// Extract meaningful error message
						let errorMessage = "Failed to load models. Please check your Base URL and API Key."

						if (error.message) {
							if (error.message.includes("Network Error")) {
								errorMessage = "Network Error: Unable to connect to the API. Please verify your Base URL."
							} else if (error.message.includes("401")) {
								errorMessage = "Authentication Error (401): Invalid API Key. Please check your credentials."
							} else if (error.message.includes("403")) {
								errorMessage =
									"Access Forbidden (403): Your API Key doesn't have permission to access this endpoint."
							} else if (error.message.includes("404")) {
								errorMessage = "Not Found (404): The API endpoint doesn't exist. Please verify your Base URL."
							} else if (error.message.includes("500")) {
								errorMessage = "Server Error (500): The API server encountered an error. Please try again later."
							} else if (error.message.includes("timeout")) {
								errorMessage = "Request Timeout: The server took too long to respond. Please try again."
							} else {
								errorMessage = `Error: ${error.message}`
							}
						}

						setModelError(errorMessage)
					})
			}, 500)
		} else {
			setAvailableModels([])
			setIsLoadingModels(false)
			setModelError(null)
		}
	}, [])

	return (
		<div>
			<Tooltip>
				<div className="mb-2.5">
					<TooltipTrigger asChild>
						<div className="flex items-center gap-2 mb-1">
							<span style={{ fontWeight: 500 }}>Base URL</span>
							{remoteConfigSettings?.openAiBaseUrl !== undefined && (
								<i className="codicon codicon-lock text-description text-sm" />
							)}
						</div>
					</TooltipTrigger>
					<DebouncedTextField
						disabled={remoteConfigSettings?.openAiBaseUrl !== undefined}
						initialValue={apiConfiguration?.openAiBaseUrl || ""}
						onChange={(value) => {
							handleFieldChange("openAiBaseUrl", value)
							debouncedRefreshOpenAiModels(value, apiConfiguration?.openAiApiKey)
						}}
						placeholder={"Enter base URL..."}
						style={{ width: "100%" }}
						type="text"
					/>
					<TooltipContent hidden={remoteConfigSettings?.openAiBaseUrl === undefined}>
						This setting is managed by your organization's remote configuration
					</TooltipContent>
				</div>
			</Tooltip>

			<ApiKeyField
				initialValue={apiConfiguration?.openAiApiKey || ""}
				onChange={(value) => {
					handleFieldChange("openAiApiKey", value)
					debouncedRefreshOpenAiModels(apiConfiguration?.openAiBaseUrl, value)
				}}
				providerName="OpenAI Compatible"
			/>

			<div style={{ marginBottom: 10 }}>
				<span style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>Model ID</span>
				{isLoadingModels ? (
					<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>Loading models...</div>
				) : modelError ? (
					<div
						style={{
							fontSize: "12px",
							color: "var(--vscode-errorForeground)",
							backgroundColor: "var(--vscode-inputValidation-errorBackground)",
							border: "1px solid var(--vscode-inputValidation-errorBorder)",
							padding: "8px",
							borderRadius: "3px",
							marginBottom: "8px",
						}}>
						{modelError}
					</div>
				) : availableModels.length > 0 ? (
					<VSCodeDropdown
						onChange={(e: any) =>
							handleModeFieldChange(
								{ plan: "planModeOpenAiModelId", act: "actModeOpenAiModelId" },
								e.target.value,
								currentMode,
							)
						}
						style={{ width: "100%" }}
						value={selectedModelId || ""}>
						<VSCodeOption value="">Select a model...</VSCodeOption>
						{availableModels.map((model) => (
							<VSCodeOption key={model} value={model}>
								{model}
							</VSCodeOption>
						))}
					</VSCodeDropdown>
				) : (
					<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
						Enter Base URL and API Key to load models
					</div>
				)}
			</div>
		</div>
	)
}
