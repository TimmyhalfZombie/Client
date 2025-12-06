# Expo/React Native Wireless Debugging Firewall Rules
# Run this script as Administrator to allow wireless debugging with firewall enabled

Write-Host "Setting up firewall rules for Expo wireless debugging..." -ForegroundColor Cyan
Write-Host ""

# Metro Bundler (default port)
Write-Host "Adding rule for Metro Bundler (port 8081)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Expo Metro Bundler (8081)" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

# Expo DevTools ports
Write-Host "Adding rule for Expo DevTools (port 19000)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Expo DevTools (19000)" -Direction Inbound -Protocol TCP -LocalPort 19000 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

Write-Host "Adding rule for Expo DevTools (port 19001)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Expo DevTools (19001)" -Direction Inbound -Protocol TCP -LocalPort 19001 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

Write-Host "Adding rule for Expo Web Interface (port 19002)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Expo Web Interface (19002)" -Direction Inbound -Protocol TCP -LocalPort 19002 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

# Node.js server port
Write-Host "Adding rule for Node.js Server (port 3000)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Node.js Server (3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

# Additional common Expo ports
Write-Host "Adding rule for Expo (port 8082)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "Expo (8082)" -Direction Inbound -Protocol TCP -LocalPort 8082 -Action Allow -Profile Private,Public -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firewall rules have been configured!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now turn ON your Windows Firewall and still use wireless debugging." -ForegroundColor White
Write-Host ""
Write-Host "Ports allowed:" -ForegroundColor Yellow
Write-Host "  - 8081: Metro Bundler" -ForegroundColor White
Write-Host "  - 8082: Expo alternative port" -ForegroundColor White
Write-Host "  - 19000: Expo DevTools" -ForegroundColor White
Write-Host "  - 19001: Expo DevTools" -ForegroundColor White
Write-Host "  - 19002: Expo Web Interface" -ForegroundColor White
Write-Host "  - 3000: Node.js Server" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
