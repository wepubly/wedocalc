"""Exercise the generated public pages against a local static server."""
import sys
from playwright.sync_api import sync_playwright, expect

origin = sys.argv[1]
cases = {
    'paint-cost-calculator': ('price', '50', '$215.00'),
    'exterior-paint-calculator': ('coverage', '400', '6.6 gal'),
    'ceiling-paint-calculator': ('coverage', '400', '0.66 gal'),
    'room-paint-calculator': ('coverage', '400', '1.716 gal'),
    'trim-paint-calculator': ('coverage', '400', '0.1833 gal'),
}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for width in (1440, 390, 320):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.goto(origin+'/paint-calculator/').status == 200
        expect(page.locator('[data-mode=cost]')).to_be_hidden()
        expect(page.locator('[data-mode=needed]')).to_be_visible()
        expect(page.locator('[data-mode=coverage]')).to_be_visible()
        cards = page.locator('.paint-tool-card a')
        expect(cards).to_have_count(5)
        expect(page.locator(".paint-tool-card")).to_have_count(6)
        if width == 1440:
            assert page.locator('.paint-tools').evaluate(
                "el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 3
        for slug, (field, value, answer) in cases.items():
            assert page.goto(origin+'/'+slug+'/').status == 200
            expect(page.locator('h1')).to_have_count(1)
            related = page.locator('.paint-tool-card')
            expect(related).to_have_count(6)
            expect(related.locator('a[href="/paint-calculator/"]')).to_have_count(1)
            expect(related.locator('a[href="/'+slug+'/"]')).to_have_count(0)
            expect(page.locator('link[rel=canonical]')).to_have_attribute(
                'href', 'https://homeimprovement.tools/'+slug+'/')
            expect(page.locator('meta[name=robots]')).to_have_attribute('content','noindex, nofollow')
            expect(page.get_by_role('button',name='Project Planner Advanced Coming Soon')).to_be_disabled()
            expect(page.locator('header')).to_be_visible()
            expect(page.locator('footer')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            input_field = page.locator('#'+field)
            input_field.fill(value)
            page.get_by_role('button',name='Calculate Estimate').click()
            expect(page.locator('#specialized-result')).to_have_text(answer)
            input_field.fill('')
            expect(page.locator('#specialized-result')).to_have_text('—')
            expect(page.locator('#specialized-print')).to_be_disabled()
            input_field.fill(value)
            page.evaluate('window.print=()=>{window.printCalled=true}')
            page.locator('#specialized-print').click()
            assert page.evaluate('window.printCalled===true')
            page.emulate_media(media='print')
            expect(page.locator('#specialized-result')).to_be_visible()
            expect(page.locator('#specialized-form')).to_be_hidden()
            page.emulate_media(media='screen')
        print(f'Passed all five calculators at {width}px, including invalid input and print')
    page.goto(origin+'/paint-calculator/?mode=cost&v=4&v=10&v=0&u=gallons&u=USD&u=USD')
    expect(page.locator('#result-value')).to_have_text('$40.00')
    assert not errors,errors
    browser.close()
