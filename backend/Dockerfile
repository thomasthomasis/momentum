# Build — compiles the C# code
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Momentum.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Runtime — runs the compiled output (smaller image, no SDK)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Don't run as root — limits blast radius if the process is ever compromised.
RUN useradd --uid 5678 --create-home appuser && chown -R appuser /app
USER appuser

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "Momentum.Api.dll"]