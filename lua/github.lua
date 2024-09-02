json = require("json")

if not db then
    db = require "lsqlite3".open_memory()
end

db:exec[[
CREATE TABLE IF NOT EXISTS User (
    Id Integer PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT NOT NULL,
    InstallationId TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
);
]]

Handlers.add(
    "ARlink.SetInstallationId",
    Handlers.utils.hasMatchingTag("Action", "ARlink.SetInstallationId"),
    function(msg)
        db:exec(string.format([[
        INSERT INTO User (Name, Email, InstallationId, CreatedAt, UpdatedAt)
        VALUES ('%s', '%s', '%s', '%s', '%s')
        ]], msg.Name, msg.Email, msg.InstallationId, msg.Timestamp, msg.Timestamp))
        ao.send({
            Target = msg.From,
            Action = "SetInstallationId",
            Data = "InstallationId set successfully"
        })
        print("InstallationId for " .. msg.Name .. " set successfully")
    end
)

Handlers.add(
    "ARlink.GetInstallationId",
    Handlers.utils.hasMatchingTag("Action", "ARlink.GetInstallationId"),
    function(msg)
        print("GetInstallationId")
        if not msg.Email or msg.Email == "" then
            ao.send({
                Target = msg.From,
                Action = "GetInstallationId",
                Data = "Invalid or missing Email"
            })
            print("Invalid or missing Email")
            return
        end
        local found = false
        for row in db:nrows(string.format([[
        SELECT InstallationId FROM User WHERE Email = '%s'
        ]], msg['Email'])) do
            found = true
            ao.send({
                Target = msg.From,
                Action = "GetInstallationId",
                Data = json.encode(row.installationId)
            })
            print("InstallationId for " .. msg.Email .. " retrieved successfully")
            break
        end
        if not found then
            ao.send({
                Target = msg.From,
                Action = "GetInstallationId",
                Data = "InstallationId not found for " .. msg.Name
            })
            print("InstallationId for " .. msg.Name .. " not found")
        end
    end
)

return "InstallationId set successfully"