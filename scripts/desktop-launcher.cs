using System;
using System.Diagnostics;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("Rocket Run - White House Arcade")]
[assembly: AssemblyProduct("Rocket Run White House Arcade Launcher")]
[assembly: AssemblyVersion("1.0.0.0")]

// The Windows desktop icon is embedded in this executable at build time.
// Opening it delegates only this fixed game address to the default browser.
internal static class RocketRunLauncher
{
    private const string GameUrl = "https://whitehouse-rocket-run-tboy450.tboy450.chatgpt.site/";

    [STAThread]
    private static int Main()
    {
        try
        {
            Process.Start(new ProcessStartInfo(GameUrl) { UseShellExecute = true });
            return 0;
        }
        catch (Exception)
        {
            MessageBox.Show("Windows could not open your default browser.\n\nOpen this address in your browser:\n" + GameUrl,
                "Rocket Run", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }
}
